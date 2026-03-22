import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find all users who have 0 credits or no credit entry
  const { data: users, error } = await admin.from("users").select("id, email");
  if (error) throw error;

  let granted = 0;
  for (const user of users) {
    const { data: creds } = await admin
      .from("user_credits")
      .select("credits_remaining")
      .eq("user_id", user.id)
      .single();

    if (!creds || creds.credits_remaining === 0) {
      console.log(`Granting 100 credits to ${user.email}...`);
      await admin.from("user_credits").upsert({
        user_id: user.id,
        plan: "free",
        credits_remaining: 100,
        credits_total: 100,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 86_400_000).toISOString(),
        is_subscriber: false,
        daily_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
      });

      await admin.from("credit_transactions").insert({
        user_id: user.id,
        amount: 100,
        action: "system_adjustment",
        description: "100 Free Inceptive Credits granted",
      });
      granted++;
    }
  }

  console.log(`Successfully granted 100 credits to ${granted} users.`);
}

main().catch(console.error);
