import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
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
    const {
      slides = [],
      title = "Presentation",
      filename = "presentation.pptx",
    } = body;

    // Validate input
    if (!Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: "Invalid slides: expected non-empty array" },
        { status: 400 }
      );
    }

    // Create presentation
    const pres = new PptxGenJS();

    // Set metadata
    pres.title = title;
    pres.author = "Inceptive AI";
    pres.subject = title;

    // Process each slide
    for (const slideData of slides) {
      const slide = pres.addSlide();

      // Title if provided
      if (slideData.title) {
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.5,
          w: "90%",
          h: 0.8,
          fontSize: 32,
          bold: true,
          color: "2E4057",
        });
      }

      // Content (bullets or plain text)
      if (slideData.content && Array.isArray(slideData.content)) {
        slide.addText(slideData.content, {
          x: 0.5,
          y: 1.5,
          w: "90%",
          h: "70%",
          fontSize: 18,
          color: "333333",
          bullet: true,
        });
      } else if (slideData.content && typeof slideData.content === "string") {
        slide.addText(slideData.content, {
          x: 0.5,
          y: 1.5,
          w: "90%",
          h: "70%",
          fontSize: 18,
          color: "333333",
        });
      }

      // Notes if provided
      if (slideData.notes) {
        slide.addNotes(slideData.notes);
      }

      // Background color if provided
      if (slideData.backgroundColor) {
        slide.background = { color: slideData.backgroundColor };
      }
    }

    // Generate as base64
    const buffer = await pres.write({ type: "buffer" });
    const base64 = buffer.toString("base64");

    return NextResponse.json({
      success: true,
      filename,
      title,
      content: base64,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      slideCount: slides.length,
    });
  } catch (error: any) {
    console.error("PowerPoint generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PowerPoint" },
      { status: 500 }
    );
  }
}

// Simple GET endpoint for basic presentations
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Presentation";
  const filename = searchParams.get("filename") || "presentation.pptx";

  // Create a simple default presentation
  const pres = new PptxGenJS();
  pres.title = title;
  pres.author = "Inceptive AI";

  const slide = pres.addSlide();
  slide.addText(title, {
    x: 1,
    y: 2,
    w: "80%",
    h: 1,
    fontSize: 36,
    bold: true,
    color: "2E4057",
  });
  slide.addText("Created with Inceptive AI", {
    x: 1,
    y: 3.5,
    w: "80%",
    h: 0.5,
    fontSize: 18,
    color: "666666",
  });

  try {
    const buffer = await pres.write({ type: "buffer" });
    const base64 = buffer.toString("base64");

    return NextResponse.json({
      success: true,
      filename,
      content: base64,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate PowerPoint" },
      { status: 500 }
    );
  }
}
