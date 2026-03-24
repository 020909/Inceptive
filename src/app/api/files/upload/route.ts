import { createClient } from "@/lib/supabase";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

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

    // Extract preview for text files
    let contentPreview = null;
    if (fileType === "text" || fileType === "code") {
      try {
        const text = await file.text();
        contentPreview = text.slice(0, 1000);
      } catch {
        // Ignore preview errors
      }
    }

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
