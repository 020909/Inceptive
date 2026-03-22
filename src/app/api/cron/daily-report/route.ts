/**
 * GET /api/cron/daily-report
 *
 * Vercel Cron job — runs every day at 2 AM UTC.
 * For each active user: aggregates daily actions, generates beautiful HTML report, sends via Resend.
 * Protected by CRON_SECRET header.
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateDailyReportHTML, type DailyReportData } from "@/lib/email/report-templates";

const getAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const resend = new Resend(resendKey);
  const admin = getAdmin();

  try {
    // Get all active users (users who have logged in within the last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: users } = await admin
      .from("users")
      .select("id, email")
      .gte("updated_at", sevenDaysAgo);

    if (!users || users.length === 0) {
      return NextResponse.json({ message: "No active users to report to", sent: 0 });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sentCount = 0;

    for (const user of users) {
      if (!user.email) continue;

      try {
        // Aggregate daily stats
        const [tasks, emails, research, social] = await Promise.all([
          admin.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString()),
          admin.from("emails").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "sent").gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString()),
          admin.from("research_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString()),
          admin.from("social_posts").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString()),
        ]);

        // Get recent credit transactions for action details
        const { data: transactions } = await admin
          .from("credit_transactions")
          .select("action, description, created_at")
          .eq("user_id", user.id)
          .gte("created_at", yesterday.toISOString())
          .lt("created_at", today.toISOString())
          .order("created_at", { ascending: false })
          .limit(5);

        const topActions = (transactions || []).map((t) => ({
          action: t.action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          detail: t.description || "",
          time: new Date(t.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        }));

        const totalActions = (tasks.count || 0) + (emails.count || 0) + (research.count || 0) + (social.count || 0);

        const reportData: DailyReportData = {
          userName: user.email.split("@")[0],
          date: yesterday.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          tasksCompleted: tasks.count || 0,
          emailsSent: emails.count || 0,
          researchReports: research.count || 0,
          socialPosts: social.count || 0,
          actionsWhileAsleep: totalActions,
          topActions,
        };

        const html = generateDailyReportHTML(reportData);

        await resend.emails.send({
          from: "Inceptive AI <reports@inceptive-ai.com>",
          to: user.email,
          subject: `☀️ Your Daily Report — ${reportData.date}`,
          html,
        });

        sentCount++;
      } catch (err) {
        console.error(`[daily-report] Failed for user ${user.id}:`, err);
      }
    }

    return NextResponse.json({ message: "Daily reports sent", sent: sentCount, total: users.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[daily-report] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
