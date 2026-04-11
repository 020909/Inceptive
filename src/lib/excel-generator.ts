import * as XLSX from "xlsx";

export interface Lead {
  name: string;
  company: string;
  title: string;
  email?: string | null;
  linkedin?: string | null;
  notes?: string | null;
  dateAdded?: string | null;
  status?: string | null;
}

export interface Activity {
  dateTime: string;
  actionType: string;
  title: string;
  description?: string | null;
  status: string;
  duration?: string | null;
}

function autoSizeColumns(rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] ?? {});
  return keys.map((key) => ({
    wch: Math.min(
      48,
      Math.max(
        key.length + 2,
        ...rows.map((row) => String(row[key] ?? "").length + 2)
      )
    ),
  }));
}

function styleHeaderRow(sheet: XLSX.WorkSheet, headers: string[]) {
  headers.forEach((_, index) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: index });
    if (!sheet[address]) return;
    sheet[address].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "111111" } },
    };
  });
}

export function generateLeadsExcel(leads: Lead[]): Buffer {
  const rows = leads.map((lead) => ({
    Name: lead.name,
    Company: lead.company,
    Title: lead.title,
    Email: lead.email ?? "",
    "LinkedIn URL": lead.linkedin ?? "",
    Notes: lead.notes ?? "",
    "Date Added": lead.dateAdded ?? "",
    Status: lead.status ?? "",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = autoSizeColumns(rows);
  styleHeaderRow(worksheet, Object.keys(rows[0] ?? {}));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function generateActivityExcel(activities: Activity[]): Buffer {
  const rows = activities.map((activity) => ({
    "Date/Time": activity.dateTime,
    "Action Type": activity.actionType,
    Title: activity.title,
    Description: activity.description ?? "",
    Status: activity.status,
    Duration: activity.duration ?? "",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = autoSizeColumns(rows);
  styleHeaderRow(worksheet, Object.keys(rows[0] ?? {}));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Log");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
