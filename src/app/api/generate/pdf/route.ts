import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { jsPDF } from "jspdf";

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
    const { content = "", title = "Document", filename = "document.pdf", user_id: passedUserId } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Title
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(title, 20, 25);

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 30, 190, 30);

    // Body content — split into lines that fit the page
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    const pageWidth = 170; // usable width in mm
    const lineHeight = 7;
    const maxY = 280; // bottom margin
    let y = 40;

    const paragraphs = content.split("\n");
    for (const paragraph of paragraphs) {
      const lines = doc.splitTextToSize(paragraph || " ", pageWidth);
      for (const line of lines) {
        if (y > maxY) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += lineHeight;
      }
      y += 3; // paragraph spacing
    }

    const pageCount = doc.getNumberOfPages();

    // Add page numbers
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
    }

    const base64 = doc.output("datauristring").split(",")[1];

    return NextResponse.json({
      status: "success",
      content: base64,
      filename,
      title,
      pageCount,
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "PDF API - use POST" });
}
