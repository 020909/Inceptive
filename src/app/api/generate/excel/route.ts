import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let userId = await getAuthenticatedUserIdFromRequest(req);

  if (!userId) {
    const bodyClone = await req.clone().json().catch(() => ({}));
    userId = bodyClone.user_id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, filename = "export.xlsx", user_id: passedUserId } = body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Invalid or empty data array" }, { status: 400 });
    }

    // Build workbook from data array
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...data.map((row: any) => String(row[key] ?? "").length)) + 2,
    }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Write to buffer
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const base64 = Buffer.from(buf).toString("base64");

    return NextResponse.json({
      status: "success",
      content: base64,
      filename,
      rowCount: data.length,
    });
  } catch (error: any) {
    console.error("Excel generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Excel API - use POST" });
}
