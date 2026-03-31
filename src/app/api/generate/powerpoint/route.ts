import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import PptxGenJS from "pptxgenjs";

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
    const { slides, title = "Presentation", filename = "presentation.pptx", user_id: passedUserId } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json({ error: "Invalid or empty slides array" }, { status: 400 });
    }

    const pptx = new PptxGenJS();
    pptx.title = title;
    pptx.layout = "LAYOUT_WIDE";

    for (const slideData of slides) {
      const slide = pptx.addSlide();

      // Dark background
      slide.background = { color: "1a1a2e" };

      // Title
      if (slideData.title) {
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.4,
          w: "90%",
          h: 1,
          fontSize: 28,
          bold: true,
          color: "FFFFFF",
          fontFace: "Arial",
        });
      }

      // Content / body text
      const content = slideData.content || slideData.body || slideData.text || "";
      if (content) {
        slide.addText(content, {
          x: 0.5,
          y: 1.8,
          w: "90%",
          h: 3.5,
          fontSize: 16,
          color: "CCCCCC",
          fontFace: "Arial",
          valign: "top",
          breakLine: true,
        });
      }

      // Bullet points
      if (slideData.bullets && Array.isArray(slideData.bullets)) {
        const bulletText = slideData.bullets.map((b: string) => ({
          text: b,
          options: { fontSize: 14, color: "BBBBBB", bullet: true, breakLine: true },
        }));
        slide.addText(bulletText, {
          x: 0.5,
          y: content ? 3.5 : 1.8,
          w: "90%",
          h: 2.5,
          fontFace: "Arial",
          valign: "top",
        });
      }
    }

    // Write to base64
    const arrayBuffer = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({
      status: "success",
      content: base64,
      filename,
      title,
      slideCount: slides.length,
    });
  } catch (error: any) {
    console.error("PowerPoint generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "PowerPoint API - use POST" });
}
