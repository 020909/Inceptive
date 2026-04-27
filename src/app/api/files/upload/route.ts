import { createClient } from "@/lib/supabase";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { extractTextWithTika } from "@/lib/files/tika-extract";
import PDFParser from "pdf2json";

const TIKA_OFFICE_EXT = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "epub",
]);

export const runtime = "nodejs";

// POST /api/files/upload — upload file to Supabase Storage
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folderPath = (formData.get("folder_path") as string) || "/";
    const parentId = (formData.get("parent_id") as string) || null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }

    // Validate file size (100MB limit)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "File too large. Max 100MB." }),
        { status: 400 }
      );
    }

    // Determine file type
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    const fileType = getFileType(fileExtension, file.type);

    const supabase = createClient();

    // Generate unique storage path: {user_id}/{random_id}/{filename}
    const fileId = crypto.randomUUID();
    const storagePath = `${userId}/${fileId}/${file.name}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("user-files")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Storage error:", uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Extract preview for supported Node-side formats (without external parsers/services).
    const contentPreview = await extractContentPreview(file, fileType);

    // Register in database
    const { data: dbFile, error: dbError } = await supabase
      .from("user_files")
      .insert({
        user_id: userId,
        name: file.name,
        storage_path: storagePath,
        folder_path: folderPath,
        file_type: fileType,
        mime_type: file.type,
        size_bytes: file.size,
        content_preview: contentPreview,
        parent_id: parentId,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback storage upload
      await supabase.storage.from("user-files").remove([storagePath]);
      throw dbError;
    }

    // Get public URL (if bucket is public) or signed URL
    const { data: urlData } = await supabase.storage
      .from("user-files")
      .createSignedUrl(storagePath, 3600); // 1 hour

    return new Response(
      JSON.stringify({
        file: dbFile,
        url: urlData?.signedUrl || null,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Upload failed" }),
      { status: 500 }
    );
  }
}

async function extractContentPreview(file: File, fileType: string): Promise<string | null> {
  try {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    if (fileType === "text" || fileType === "code") {
      return normalizeText(await file.text(), 12000);
    }

    if (fileType === "spreadsheet") {
      // CSV/TSV can be processed directly in Node. Binary spreadsheet formats are intentionally skipped.
      if (extension === "csv" || extension === "tsv") {
        return normalizeText(await file.text(), 12000);
      }
      return null;
    }

    if (fileType === "pdf") {
      const buf = Buffer.from(await file.arrayBuffer());
      const text = await new Promise<string>((resolve, reject) => {
        const pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", (errMsg: any) => reject(errMsg.parserError || errMsg));
        pdfParser.on("pdfParser_dataReady", (data: any) => resolve(data.Text || ""));
        pdfParser.parseBuffer(buf);
      });
      return normalizeText(text, 12000);
    }

    if (TIKA_OFFICE_EXT.has(extension)) {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime =
        file.type ||
        (extension === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : extension === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : extension === "pptx"
              ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
              : "application/octet-stream");
      const tika = await extractTextWithTika(buf, mime);
      if (tika) return normalizeText(tika, 12000);
    }

    // Handle JSON/XML/HTML-like payloads that may be uploaded with "application/*" mime.
    if (["json", "xml", "html", "md", "txt"].includes(extension) || /application\/(json|xml)/i.test(file.type)) {
      return normalizeText(await file.text(), 12000);
    }

    return null;
  } catch {
    // Preview extraction is best-effort; upload should still succeed.
    return null;
  }
}

function normalizeText(text: string, maxChars: number): string {
  return text.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, maxChars);
}

function getFileType(extension: string, mimeType: string): string {
  // Code files
  const codeExtensions = [
    "js", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "kt",
    "swift", "cpp", "c", "h", "hpp", "cs", "php", "html", "css", "scss",
    "json", "xml", "yaml", "yml", "sql", "sh", "bash", "zsh", "ps1",
    "dockerfile", "makefile", "cmake", "md", "mdx", "vue", "svelte"
  ];

  // Image files
  const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];

  // Spreadsheet files
  const spreadsheetExtensions = ["csv", "xls", "xlsx", "ods"];

  // PDF
  if (extension === "pdf" || mimeType.includes("pdf")) return "pdf";

  // Images
  if (imageExtensions.includes(extension) || mimeType.startsWith("image/")) {
    return "image";
  }

  // Spreadsheets
  if (spreadsheetExtensions.includes(extension)) return "spreadsheet";

  // Code/Text
  if (codeExtensions.includes(extension) || mimeType.startsWith("text/")) {
    return codeExtensions.includes(extension) ? "code" : "text";
  }

  return "other";
}
