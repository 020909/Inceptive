import { createClient } from "@supabase/supabase-js";
import type { ConnectorContext, GmailConnector } from "./types";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const gmailConnector: GmailConnector = {
  id: "gmail",
  async isLinked(ctx: ConnectorContext) {
    const { data, error } = await admin()
      .from("connected_accounts")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("provider", "gmail")
      .maybeSingle();
    if (error) return false;
    return !!data;
  },
};
