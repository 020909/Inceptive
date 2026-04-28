import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { inngest } from "@/lib/inngest/client";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import {
  getBearerJwtFromRequest,
  getIpAddressFromRequest,
  getTenantIdFromRequest,
} from "@/lib/ubo/requestContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFileName(name: string): string {
  const base = name.split("/").pop() || "document";
  return base.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant_id in JWT" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (50MB max)" }, { status: 413 });
    }

    const mimeType = (file.type || "").toLowerCase().trim();
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const fileName = safeFileName(file.name || "document");
    const documentId = crypto.randomUUID();
    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const storagePath = `${tenantId}/${documentId}/${Date.now()}-${fileName.replace(ext, "")}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await admin.storage.from("kyb-documents").upload(storagePath, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadRes.error) throw new Error(uploadRes.error.message);

    const signed = await admin.storage.from("kyb-documents").createSignedUrl(storagePath, 60 * 60);
    const fileUrl = signed.data?.signedUrl || "";

    const { data: docRow, error: docErr } = await admin
      .from("documents")
      .insert({
        id: documentId,
        tenant_id: tenantId,
        file_name: fileName,
        file_url: storagePath,
        file_type: mimeType,
        parsing_status: "pending",
        uploaded_by: userId,
      })
      .select()
      .single();
    if (docErr) throw new Error(docErr.message);

    const placeholderDraft = {
      kind: "ubo_extraction",
      status: "pending",
      document_id: documentId,
      note: "Awaiting AI extraction",
    };

    const { data: queueRow, error: queueErr } = await admin
      .from("approval_queue")
      .insert({
        tenant_id: tenantId,
        case_type: "ubo_extraction",
        entity_id: null,
        entity_type: null,
        ai_draft: placeholderDraft,
        status: "pending",
        citations: null,
      })
      .select()
      .single();
    if (queueErr) throw new Error(queueErr.message);

    const ip = getIpAddressFromRequest(request);
    const jwt = getBearerJwtFromRequest(request);
    const actorEmail =
      jwt ? (await admin.auth.getUser(jwt)).data.user?.email || "unknown" : "unknown";
    await admin.from("audit_log").insert({
      tenant_id: tenantId,
      actor_id: userId,
      actor_email: actorEmail,
      action_type: "ubo_upload_accepted",
      entity_type: "documents",
      entity_id: documentId,
      after_state: { storage_path: storagePath, mime_type: mimeType, file_name: fileName },
      ip_address: ip,
    });

    await inngest.send({
      name: "ubo/document.uploaded",
      data: {
        tenant_id: tenantId,
        document_id: documentId,
        queue_id: queueRow.id,
        file_path: storagePath,
        file_url: fileUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      tenant_id: tenantId,
      document: docRow,
      queue: queueRow,
      file_path: storagePath,
      file_url: fileUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("[ubo/upload] error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

