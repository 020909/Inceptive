import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, sheetName = "Sheet1", filename = "export.xlsx" } = body;

    // Validate input
    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Invalid data: expected non-empty array" },
        { status: 400 }
      );
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate buffer
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    // Return as base64
    const base64 = buffer.toString("base64");

    return NextResponse.json({
      success: true,
      filename,
      content: base64,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rowCount: data.length,
    });
  } catch (error: any) {
    console.error("Excel generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate Excel file" },
      { status: 500 }
    );
  }
}

// Also support GET for simple exports
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dataParam = searchParams.get("data");
  const sheetName = searchParams.get("sheet") || "Sheet1";
  const filename = searchParams.get("filename") || "export.xlsx";

  if (!dataParam) {
    return NextResponse.json(
      { error: "Missing data parameter" },
      { status: 400 }
    );
  }

  try {
    const data = JSON.parse(decodeURIComponent(dataParam));

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Invalid data array" },
        { status: 400 }
      );
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    const base64 = buffer.toString("base64");

    return NextResponse.json({
      success: true,
      filename,
      content: base64,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate Excel" },
      { status: 500 }
    );
  }
}
