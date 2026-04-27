import { createClient } from "@/lib/supabase";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import PDFParser from "pdf2json";

export const runtime = "nodejs";

// Maximum file size for parsing (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Supported file types
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const SUPPORTED_PDF_TYPE = "application/pdf";

interface OpenRouterVisionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// ─── PDF Parsing Helper ──────────────────────────────────────────────────────

async function parsePDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errMsg: any) => {
      reject(errMsg.parserError || errMsg);
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      resolve(pdfData.Text || "");
    });

    pdfParser.parseBuffer(buffer);
  });
}

// ─── Image Parsing Helper ────────────────────────────────────────────────────

async function parseImageWithVision(buffer: Buffer, mimeType: string): Promise<string> {
  const base64Image = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Inceptive Compliance",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this document. Preserve the structure and formatting as much as possible. Include names, dates, percentages, and any numerical data.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.status}`);
  }

  const data: OpenRouterVisionResponse = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── Text Cleaning Helper ────────────────────────────────────────────────────

function cleanExtractedText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

// ─── Database Helper Functions ───────────────────────────────────────────────

async function updateDocumentStatus(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  status: "pending" | "parsing" | "completed" | "failed",
  parsedText?: string | null,
  errorMessage?: string | null
) {
  const updates: Record<string, unknown> = {
    parsing_status: status,
    updated_at: new Date().toISOString(),
  };

  if (parsedText !== undefined) {
    updates.parsed_text = parsedText;
  }

  if (errorMessage !== undefined) {
    updates.parsing_error = errorMessage;
  }

  if (status === "completed") {
    updates.parsed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("case_documents")
    .update(updates)
    .eq("id", documentId);

  if (error) {
    console.error("[Parse] Failed to update document status:", error);
  }
}

async function logAuditEvent(
  supabase: ReturnType<typeof createClient>,
  {
    orgId,
    caseId,
    documentId,
    userId,
    action,
    details,
  }: {
    orgId: string;
    caseId: string;
    documentId: string;
    userId: string;
    action: string;
    details: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("audit_trail").insert({
    org_id: orgId,
    action,
    entity_type: "document",
    entity_id: documentId,
    actor_id: userId,
    metadata: {
      case_id: caseId,
      ...details,
    },
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[Parse] Failed to log audit event:", error);
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // Verify authentication
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { documentId, caseId, orgId } = body;

    if (!documentId || !caseId || !orgId) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: documentId, caseId, orgId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient();

    // Get document record from database
    const { data: document, error: docError } = await supabase
      .from("case_documents")
      .select("*")
      .eq("id", documentId)
      .eq("case_id", caseId)
      .eq("org_id", orgId)
      .single();

    if (docError || !document) {
      console.error("[Parse] Document not found:", docError);
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check file size
    if (document.file_size > MAX_FILE_SIZE) {
      await updateDocumentStatus(supabase, documentId, "failed", null, "File too large (max 50MB)");
      return new Response(
        JSON.stringify({ error: "File too large. Maximum size is 50MB." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update status to parsing
    await updateDocumentStatus(supabase, documentId, "parsing");

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("case-documents")
      .download(document.storage_path);

    if (downloadError || !fileData) {
      console.error("[Parse] Download error:", downloadError);
      await updateDocumentStatus(
        supabase,
        documentId,
        "failed",
        null,
        "Failed to download file from storage"
      );
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    let extractedText = "";

    try {
      // Parse based on file type
      const mimeType = document.mime_type || document.file_type;
      
      if (mimeType === SUPPORTED_PDF_TYPE || document.file_type === "pdf") {
        // Parse PDF
        extractedText = await parsePDF(buffer);
      } else if (SUPPORTED_IMAGE_TYPES.has(mimeType) || SUPPORTED_IMAGE_TYPES.has(document.file_type)) {
        // Parse image using OpenRouter Vision
        extractedText = await parseImageWithVision(buffer, mimeType || document.file_type);
      } else {
        // Unsupported file type
        await updateDocumentStatus(
          supabase,
          documentId,
          "failed",
          null,
          `Unsupported file type: ${mimeType || document.file_type}`
        );
        return new Response(
          JSON.stringify({ error: "Unsupported file type" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Clean up extracted text
      extractedText = cleanExtractedText(extractedText);

      // Update document row with extracted text
      await updateDocumentStatus(supabase, documentId, "completed", extractedText);

      // Log to audit_trail
      await logAuditEvent(supabase, {
        orgId,
        caseId,
        documentId,
        userId,
        action: "DOCUMENT_PARSED",
        details: {
          file_name: document.file_name,
          file_type: document.file_type,
          char_count: extractedText.length,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          documentId,
          extractedText,
          charCount: extractedText.length,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (parseError: any) {
      console.error("[Parse] Parsing error:", parseError);
      await updateDocumentStatus(
        supabase,
        documentId,
        "failed",
        null,
        parseError.message || "Failed to parse document"
      );

      // Log failure to audit_trail
      await logAuditEvent(supabase, {
        orgId,
        caseId,
        documentId,
        userId,
        action: "DOCUMENT_PARSE_FAILED",
        details: {
          file_name: document.file_name,
          error: parseError.message,
        },
      });

      return new Response(
        JSON.stringify({
          error: "Failed to parse document",
          details: parseError.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    console.error("[Parse] Unexpected error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
