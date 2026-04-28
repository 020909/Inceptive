import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase-admin";
import { parseDocumentToText } from "@/lib/ubo/parser";
import { extractUboFromText } from "@/lib/ubo/extractor";
import { buildOwnershipTree } from "@/lib/ubo/treeBuilder";
import { screenEntity } from "@/lib/ubo/screener";

function nowIso() {
  return new Date().toISOString();
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  // Ensure we always return a plain ArrayBuffer (never SharedArrayBuffer) for downstream parsing.
  return Uint8Array.from(buf).buffer;
}

export const uboParser = inngest.createFunction(
  { id: "ubo-parser", triggers: [{ event: "ubo/document.uploaded" }] },
  async ({ event, step }) => {
    const admin = createAdminClient();
    const tenantId = event.data.tenant_id;
    const documentId = event.data.document_id;
    const queueId = event.data.queue_id;
    const filePath = event.data.file_path;

    const ctx = await step.run("load-document", async () => {
      const { data: doc, error } = await admin
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();
      if (error) throw new Error(error.message);
      return doc as any;
    });

    const actorId: string = ctx.uploaded_by || "00000000-0000-0000-0000-000000000000";
    const actorEmail: string = "system@inceptive-ai.com";

    const fileBase64 = await step.run("download-from-storage", async () => {
      const { data, error } = await admin.storage.from("kyb-documents").download(filePath);
      if (error) throw new Error(error.message);
      const arr = await data.arrayBuffer();
      return Buffer.from(arr).toString("base64");
    });

    const parsed = await step.run("parse-document", async () => {
      const mimeType = (ctx.file_type || "").toString();
      const bytes = bufferToArrayBuffer(Buffer.from(fileBase64, "base64"));
      const { text, citations } = await parseDocumentToText({ mimeType, bytes });

      await admin
        .from("documents")
        .update({
          parsed_content: text,
          parsing_status: "complete",
        })
        .eq("id", documentId);

      await admin.from("audit_log").insert({
        tenant_id: tenantId,
        actor_id: actorId,
        actor_email: actorEmail,
        action_type: "ubo_parsing_complete",
        entity_type: "documents",
        entity_id: documentId,
        after_state: { parsing_status: "complete" },
      });

      return { text, citations };
    });

    const extraction = await step.run("extract-ubo", async () => {
      const { result, extraction_confidence, gate_passed } = await extractUboFromText(parsed.text);

      await admin.from("audit_log").insert({
        tenant_id: tenantId,
        actor_id: actorId,
        actor_email: actorEmail,
        action_type: "ubo_extraction_complete",
        entity_type: "documents",
        entity_id: documentId,
        after_state: { extraction_confidence, gate_passed },
      });

      return { result, extraction_confidence, gate_passed };
    });

    const tree = await step.run("build-tree", async () => {
      return buildOwnershipTree(extraction.result);
    });

    const screening = await step.run("screen-entities", async () => {
      const persons = extraction.result.persons || [];
      const screenedPersons = await Promise.all(
        persons.map(async (p) => ({
          full_name: p.full_name,
          result: await screenEntity({ name: p.full_name, schema: "Person", nationality: p.nationality }),
        }))
      );

      await admin.from("audit_log").insert({
        tenant_id: tenantId,
        actor_id: actorId,
        actor_email: actorEmail,
        action_type: "ubo_screening_complete",
        entity_type: "documents",
        entity_id: documentId,
        after_state: { screened: true, count: screenedPersons.length },
      });

      return { persons: screenedPersons };
    });

    await step.run("update-approval-queue", async () => {
      const citations = {
        parsing: parsed.citations,
        extraction: extraction.result,
      };

      const aiDraft = {
        kind: "ubo_extraction",
        document_id: documentId,
        extraction: extraction.result,
        ownership_graph: { nodes: tree.nodes, edges: tree.edges },
        effective_ownership: tree.effectiveOwnership,
        ubo_over_25: tree.uboOver25,
        circular: tree.circular,
        screening,
        gate: { extraction_confidence: extraction.extraction_confidence, passed: extraction.gate_passed, threshold: 0.7 },
      };

      await admin
        .from("approval_queue")
        .update({
          ai_draft: aiDraft,
          citations,
          ai_confidence: extraction.extraction_confidence,
          status: "pending",
          updated_at: nowIso(),
        })
        .eq("id", queueId);

      await admin.from("audit_log").insert([
        {
          tenant_id: tenantId,
          actor_id: actorId,
          actor_email: actorEmail,
          action_type: "ubo_queue_updated",
          entity_type: "approval_queue",
          entity_id: queueId,
          after_state: { ai_confidence: extraction.extraction_confidence },
        },
        {
          tenant_id: tenantId,
          actor_id: actorId,
          actor_email: actorEmail,
          action_type: "ubo_decision_pending",
          entity_type: "approval_queue",
          entity_id: queueId,
          after_state: { status: "pending" },
        },
      ]);
    });

    return {
      ok: true,
      tenant_id: tenantId,
      document_id: documentId,
      queue_id: queueId,
      file_path: filePath,
    };
  }
);

