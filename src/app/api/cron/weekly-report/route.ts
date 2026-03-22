/**
 * GET /api/cron/weekly-report
 *
 * Vercel Cron job — runs every Sunday at 9 AM UTC.
 * Full weekly summary with stats + highlights, sent via Resend.
 * Protected by CRON_SECRET header.
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateWeeklyReportHTML, type WeeklyReportData } from "@/lib/email/report-templates";

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
    // Get all active users
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: users } = await admin
      .from("users")
      .select("id, email")
      .gte("updated_at", thirtyDaysAgo);

    if (!users || users.length === 0) {
      return NextResponse.json({ message: "No active users to report to", sent: 0 });
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() - 7); // Last week's Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const dateRange = `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    let sentCount = 0;

    for (const user of users) {
      if (!user.email) continue;

      try {
        const [tasks, emails, research, social, goals] = await Promise.all([
          admin.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfWeek.toISOString()).lte("created_at", endOfWeek.toISOString()),
          admin.from("emails").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "sent").gte("created_at", startOfWeek.toISOString()).lte("created_at", endOfWeek.toISOString()),
          admin.from("research_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfWeek.toISOString()).lte("created_at", endOfWeek.toISOString()),
          admin.from("social_posts").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfWeek.toISOString()).lte("created_at", endOfWeek.toISOString()),
          admin.from("goals").select("title, progress_percent").eq("user_id", user.id).eq("status", "active").order("progress_percent", { ascending: false }).limit(1),
        ]);

        const hoursWorked = (
          (tasks.count || 0) * 0.5 +
          (research.count || 0) * 1.5 +
          (emails.count || 0) * 0.2 +
          (social.count || 0) * 0.2
        ).toFixed(1);

        const topGoal = goals.data?.[0]
          ? { title: goals.data[0].title, progress: goals.data[0].progress_percent }
          : undefined;

        // Generate highlights
        const highlights: string[] = [];
        if ((tasks.count || 0) > 0) highlights.push(`Completed ${tasks.count} tasks this week`);
        if ((emails.count || 0) > 0) highlights.push(`Sent ${emails.count} emails automatically`);
        if ((research.count || 0) > 0) highlights.push(`Generated ${research.count} research reports`);
        if ((social.count || 0) > 0) highlights.push(`Scheduled ${social.count} social media posts`);
        if (topGoal) highlights.push(`Top goal "${topGoal.title}" is ${topGoal.progress}% complete`);

        const reportData: WeeklyReportData = {
          userName: user.email.split("@")[0],
          dateRange,
          hoursWorked,
          tasksCompleted: tasks.count || 0,
          emailsSent: emails.count || 0,
          researchReports: research.count || 0,
          socialPosts: social.count || 0,
          goalsActive: (await admin.from("goals").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active")).count || 0,
          topGoal,
          weeklyHighlights: highlights,
        };

        const html = generateWeeklyReportHTML(reportData);

        await resend.emails.send({
          from: "Inceptive AI <reports@inceptive-ai.com>",
          to: user.email,
          subject: `📊 Weekly Report — ${dateRange}`,
          html,
        });

        // Also save to weekly_reports table
        await admin.from("weekly_reports").insert({
          user_id: user.id,
          week_start: startOfWeek.toISOString(),
          date_range_str: dateRange,
          hours_worked: hoursWorked,
          tasks_completed: tasks.count || 0,
          emails_sent: emails.count || 0,
          research_reports: research.count || 0,
          social_posts: social.count || 0,
          goals_active: reportData.goalsActive,
          chart_data: [],
          created_at: new Date().toISOString(),
        });

        sentCount++;
      } catch (err) {
        console.error(`[weekly-report] Failed for user ${user.id}:`, err);
      }
    }

    return NextResponse.json({ message: "Weekly reports sent", sent: sentCount, total: users.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[weekly-report] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
