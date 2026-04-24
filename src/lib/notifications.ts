import { createAdminClient } from "@/lib/supabase-admin";

export async function createNotification(params: {
  userId: string;
  orgId: string;
  title: string;
  message?: string;
  type?: "info" | "success" | "warning" | "error";
  link?: string;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("notifications").insert({
      user_id: params.userId,
      organization_id: params.orgId,
      title: params.title,
      message: params.message ?? null,
      type: params.type ?? "info",
      link: params.link ?? null,
    });
  } catch (error) {
    console.error("[notifications] Failed to create notification", error);
  }
}
