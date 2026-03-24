import { createClient } from "@/lib/supabase";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/files — list files in a folder
export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderPath = searchParams.get("path") || "/";

    const supabase = createClient();

    // Get files in the folder
    const { data: files, error } = await supabase
      .from("user_files")
      .select("*")
      .eq("user_id", userId)
      .eq("folder_path", folderPath)
      .is("parent_id", null) // Only root level items in this folder
      .order("is_folder", { ascending: false }) // Folders first
      .order("name");

    if (error) throw error;

    return new Response(JSON.stringify({ files: files || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Files GET] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to list files" }),
      { status: 500 }
    );
  }
}

// POST /api/files — create folder or register uploaded file
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    const supabaseAdmin = createClient();

    if (action === "create_folder") {
      const { name, folder_path = "/" } = body;

      if (!name) {
        return new Response(JSON.stringify({ error: "Folder name required" }), { status: 400 });
      }

      const { data, error } = await supabaseAdmin.rpc("create_user_folder", {
        p_user_id: userId,
        p_name: name,
        p_folder_path: folder_path,
      });

      if (error) throw error;

      return new Response(JSON.stringify({ id: data }), { status: 201 });
    }

    if (action === "register_file") {
      const {
        name,
        storage_path,
        folder_path = "/",
        file_type,
        mime_type,
        size_bytes,
        content_preview,
        parent_id,
      } = body;

      const { data, error } = await supabaseAdmin
        .from("user_files")
        .insert({
          user_id: userId,
          name,
          storage_path,
          folder_path,
          file_type,
          mime_type,
          size_bytes,
          content_preview: content_preview?.slice(0, 1000),
          parent_id,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ file: data }), { status: 201 });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  } catch (err: any) {
    console.error("[Files POST] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create" }),
      { status: 500 }
    );
  }
}

// DELETE /api/files — delete file or folder
export async function DELETE(req: Request) {
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

    const supabaseAdmin = createClient();

    // Get file info first
    const { data: file, error: fetchError } = await supabaseAdmin
      .from("user_files")
      .select("storage_path, is_folder")
      .eq("id", fileId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !file) {
      return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
    }

    // If it's a file (not folder), delete from storage
    if (!file.is_folder && file.storage_path) {
      await supabaseAdmin.storage.from("user-files").remove([file.storage_path]);
    }

    // Delete from database (cascades to children)
    const { error: deleteError } = await supabaseAdmin
      .from("user_files")
      .delete()
      .eq("id", fileId)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error("[Files DELETE] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to delete" }),
      { status: 500 }
    );
  }
}
