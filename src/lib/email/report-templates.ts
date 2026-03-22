/**
 * Beautiful HTML email templates for Inceptive daily and weekly reports.
 * Inline CSS for maximum email client compatibility.
 */

export interface DailyReportData {
  userName: string;
  date: string;
  tasksCompleted: number;
  emailsSent: number;
  researchReports: number;
  socialPosts: number;
  actionsWhileAsleep: number;
  topActions: Array<{ action: string; detail: string; time: string }>;
}

export interface WeeklyReportData {
  userName: string;
  dateRange: string;
  hoursWorked: string;
  tasksCompleted: number;
  emailsSent: number;
  researchReports: number;
  socialPosts: number;
  goalsActive: number;
  topGoal?: { title: string; progress: number };
  weeklyHighlights: string[];
}

export function generateDailyReportHTML(data: DailyReportData): string {
  const actionRows = data.topActions
    .map(
      (a) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #2C2C2E; color: #FFFFFF; font-size: 14px;">${a.action}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #2C2C2E; color: #8E8E93; font-size: 13px;">${a.detail}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #2C2C2E; color: #636366; font-size: 12px; text-align: right;">${a.time}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0A0A0C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; padding: 6px 16px; border-radius: 100px; background: rgba(48,209,88,0.15); color: #30D158; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px;">
        ✨ Daily Report
      </div>
      <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 700; margin: 8px 0 4px;">Good morning, ${data.userName}</h1>
      <p style="color: #8E8E93; font-size: 14px; margin: 0;">${data.date}</p>
    </div>

    <!-- Hero stat -->
    <div style="background: linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%); border-radius: 20px; padding: 28px; text-align: center; margin-bottom: 20px; border: 1px solid #38383A;">
      <p style="color: #8E8E93; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 8px;">Your AI completed</p>
      <p style="color: #FFFFFF; font-size: 48px; font-weight: 800; margin: 0; line-height: 1;">${data.actionsWhileAsleep}</p>
      <p style="color: #30D158; font-size: 14px; font-weight: 600; margin: 8px 0 0;">actions while you were offline 🔥</p>
    </div>

    <!-- Stats grid -->
    <div style="display: flex; gap: 12px; margin-bottom: 20px;">
      <div style="flex: 1; background: #1C1C1E; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #2C2C2E;">
        <p style="color: #FFFFFF; font-size: 28px; font-weight: 700; margin: 0;">${data.tasksCompleted}</p>
        <p style="color: #8E8E93; font-size: 11px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 0.1em;">Tasks</p>
      </div>
      <div style="flex: 1; background: #1C1C1E; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #2C2C2E;">
        <p style="color: #FFFFFF; font-size: 28px; font-weight: 700; margin: 0;">${data.emailsSent}</p>
        <p style="color: #8E8E93; font-size: 11px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 0.1em;">Emails</p>
      </div>
      <div style="flex: 1; background: #1C1C1E; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #2C2C2E;">
        <p style="color: #FFFFFF; font-size: 28px; font-weight: 700; margin: 0;">${data.researchReports}</p>
        <p style="color: #8E8E93; font-size: 11px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 0.1em;">Research</p>
      </div>
      <div style="flex: 1; background: #1C1C1E; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #2C2C2E;">
        <p style="color: #FFFFFF; font-size: 28px; font-weight: 700; margin: 0;">${data.socialPosts}</p>
        <p style="color: #8E8E93; font-size: 11px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 0.1em;">Social</p>
      </div>
    </div>

    <!-- Actions table -->
    ${
      data.topActions.length > 0
        ? `
    <div style="background: #1C1C1E; border-radius: 16px; overflow: hidden; margin-bottom: 24px; border: 1px solid #2C2C2E;">
      <div style="padding: 16px; border-bottom: 1px solid #2C2C2E;">
        <p style="color: #FFFFFF; font-size: 14px; font-weight: 600; margin: 0;">What your AI did while you slept:</p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${actionRows}
      </table>
    </div>`
        : ""
    }

    <!-- CTA -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://app.inceptive-ai.com/dashboard" style="display: inline-block; background: #0A84FF; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 600;">
        Open Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #1C1C1E;">
      <p style="color: #48484A; font-size: 11px; margin: 0;">Inceptive AI — The AI that works while you sleep.</p>
      <p style="color: #38383A; font-size: 10px; margin: 8px 0 0;">
        <a href="https://app.inceptive-ai.com/settings" style="color: #636366; text-decoration: none;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function generateWeeklyReportHTML(data: WeeklyReportData): string {
  const highlightsHTML = data.weeklyHighlights
    .map(
      (h) =>
        `<li style="padding: 8px 0; border-bottom: 1px solid #2C2C2E; color: #C7C7CC; font-size: 13px;">✅ ${h}</li>`
    )
    .join("");

  const goalHTML = data.topGoal
    ? `
    <div style="background: #242426; border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid #38383A;">
      <p style="color: #8E8E93; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Priority Goal</p>
      <p style="color: #FFFFFF; font-size: 16px; font-weight: 600; margin: 0 0 12px;">${data.topGoal.title}</p>
      <div style="background: #38383A; border-radius: 100px; height: 6px; overflow: hidden;">
        <div style="background: #0A84FF; height: 100%; width: ${data.topGoal.progress}%; border-radius: 100px;"></div>
      </div>
      <p style="color: #8E8E93; font-size: 12px; margin: 8px 0 0; text-align: right;">${data.topGoal.progress}% complete</p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0A0A0C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; padding: 6px 16px; border-radius: 100px; background: rgba(10,132,255,0.15); color: #0A84FF; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px;">
        📊 Weekly Report
      </div>
      <h1 style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin: 8px 0 4px;">Inceptive Weekly Report</h1>
      <p style="color: #8E8E93; font-size: 16px; margin: 0;">${data.dateRange}</p>
    </div>

    <!-- Main stats card -->
    <div style="background: #1C1C1E; border-radius: 20px; padding: 28px; margin-bottom: 20px; border: 1px solid #2C2C2E;">
      <div style="display: flex; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #2C2C2E; margin-bottom: 16px;">
        <span style="color: #8E8E93; font-size: 13px;">Hours worked by your AI</span>
        <span style="color: #FFFFFF; font-size: 18px; font-weight: 700; font-family: 'SF Mono', monospace;">${data.hoursWorked}h</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #2C2C2E; margin-bottom: 16px;">
        <span style="color: #8E8E93; font-size: 13px;">Tasks completed</span>
        <span style="color: #FFFFFF; font-size: 18px; font-weight: 700; font-family: 'SF Mono', monospace;">${data.tasksCompleted}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #2C2C2E; margin-bottom: 16px;">
        <span style="color: #8E8E93; font-size: 13px;">Emails sent</span>
        <span style="color: #FFFFFF; font-size: 18px; font-weight: 700; font-family: 'SF Mono', monospace;">${data.emailsSent}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #2C2C2E; margin-bottom: 16px;">
        <span style="color: #8E8E93; font-size: 13px;">Research reports</span>
        <span style="color: #FFFFFF; font-size: 18px; font-weight: 700; font-family: 'SF Mono', monospace;">${data.researchReports}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #2C2C2E; margin-bottom: 16px;">
        <span style="color: #8E8E93; font-size: 13px;">Social posts</span>
        <span style="color: #FFFFFF; font-size: 18px; font-weight: 700; font-family: 'SF Mono', monospace;">${data.socialPosts}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #8E8E93; font-size: 13px;">Active goals</span>
        <span style="color: #FFFFFF; font-size: 18px; font-weight: 700; font-family: 'SF Mono', monospace;">${data.goalsActive}</span>
      </div>
    </div>

    ${goalHTML}

    <!-- Highlights -->
    ${
      data.weeklyHighlights.length > 0
        ? `
    <div style="background: #1C1C1E; border-radius: 16px; padding: 20px; margin-bottom: 24px; border: 1px solid #2C2C2E;">
      <p style="color: #FFFFFF; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Weekly Highlights</p>
      <ul style="list-style: none; padding: 0; margin: 0;">${highlightsHTML}</ul>
    </div>`
        : ""
    }

    <!-- System status -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 100px; background: rgba(48,209,88,0.1); border: 1px solid rgba(48,209,88,0.2);">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #30D158;"></div>
        <span style="color: #30D158; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">All systems running</span>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://app.inceptive-ai.com/reports" style="display: inline-block; background: #0A84FF; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 600;">
        View Full Report →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #1C1C1E;">
      <p style="color: #48484A; font-size: 11px; margin: 0;">Every Sunday. Delivered to your inbox by Inceptive AI.</p>
      <p style="color: #38383A; font-size: 10px; margin: 8px 0 0;">
        <a href="https://app.inceptive-ai.com/settings" style="color: #636366; text-decoration: none;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
