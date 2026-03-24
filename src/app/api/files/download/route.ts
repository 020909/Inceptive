import { createClient } from "@/lib/supabase";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/files/download?id={file_id} — get signed download URL
export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return new Response(JSON.stringify({ error: "File ID required" }), { status: 400 });
    }

    const supabase = createClient();

    // Get file metadata
    const { data: file, error: fetchError } = await supabase
      .from("user_files")
      .select("storage_path, name, mime_type, is_folder, user_id")
      .eq("id", fileId)
      .single();

    if (fetchError || !file) {
      return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
    }

    // Verify ownership
    if (file.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    // Can't download folders
    if (file.is_folder) {
      return new Response(JSON.stringify({ error: "Cannot download folders" }), { status: 400 });
    }

    // Create signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from("user-files")
      .createSignedUrl(file.storage_path, 3600);

    if (urlError) {
      throw urlError;
    }

    return new Response(
      JSON.stringify({
        url: urlData.signedUrl,
        filename: file.name,
        mime_type: file.mime_type,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Download] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to get download URL" }),
      { status: 500 }
    );
  }
}
