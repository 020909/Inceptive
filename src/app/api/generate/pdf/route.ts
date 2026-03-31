import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { jsPDF } from "jspdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Strip markdown formatting symbols from a line of text */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/, "") // Remove # heading prefixes
    .replace(/\*\*(.+?)\*\*/g, "$1") // Remove **bold**
    .replace(/\*(.+?)\*/g, "$1") // Remove *italic*
    .replace(/__(.+?)__/g, "$1") // Remove __underline__
    .replace(/_(.+?)_/g, "$1") // Remove _italic_
    .replace(/~~(.+?)~~/g, "$1") // Remove ~~strikethrough~~
    .replace(/`(.+?)`/g, "$1") // Remove `inline code`
    .replace(/^[-*+]\s+/, "") // Remove list bullets
    .replace(/^\d+\.\s+/, "") // Remove numbered list prefixes
    .replace(/^>\s+/, "") // Remove blockquotes
    .replace(/\[(.+?)\]\(.*?\)/g, "$1") // Convert links to plain text
    .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
    .replace(/₹/g, "Rs. ") // Convert Indian Rupee
    .replace(/[“”]/g, '"') // Normalize smart quotes
    .replace(/[‘’]/g, "'") // Normalize single quotes
    .replace(/–/g, "-") // Normal dash (en-dash)
    .replace(/—/g, "-") // Normal dash (em-dash)
    .replace(/…/g, "...") // Normal ellipsis
    .replace(/[^\x00-\x7F]/g, "") // STRIP ALL REMAINING NON-ASCII (fixes jsPDF kerning corruption)
    .trim();
}

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
    const { content = "", title = "Document", filename = "document.pdf" } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Title
    doc.setFontSize(18);
    doc.setFont("times", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(title, 20, 25);

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 31, 190, 31);

    const pageWidth = 170;
    const lineHeight = 7;
    const maxY = 278;
    let y = 42;

    const paragraphs = content.split("\n");
    for (const rawParagraph of paragraphs) {
      const paragraph = rawParagraph.trim();
      if (!paragraph) {
        y += 3; // Small gap for blank lines
        continue;
      }

      // Detect section headings (lines starting with #)
      const isHeading = /^#{1,6}\s/.test(paragraph);
      // Detect list items
      const isBullet = /^[-*+•\d]\s/.test(paragraph);

      const cleanText = stripMarkdown(paragraph);
      if (!cleanText) continue;

      if (isHeading) {
        // Render as bold subheading
        if (y > maxY) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.setTextColor(30, 30, 30);
        y += 3;
        const lines = doc.splitTextToSize(cleanText, pageWidth);
        for (const line of lines) {
          if (y > maxY) { doc.addPage(); y = 20; }
          doc.text(line, 20, y);
          y += lineHeight;
        }
        y += 2;
      } else {
        // Normal body text
        doc.setFontSize(12);
        doc.setFont("times", "normal");
        doc.setTextColor(60, 60, 60);
        const prefix = isBullet ? "  • " : "";
        const lines = doc.splitTextToSize((prefix + cleanText), pageWidth);
        for (const line of lines) {
          if (y > maxY) { doc.addPage(); y = 20; }
          doc.text(line, 20, y);
          y += lineHeight - 1;
        }
        y += 2;
      }
    }

    const pageCount = doc.getNumberOfPages();

    // Add page numbers
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont("times", "normal");
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
