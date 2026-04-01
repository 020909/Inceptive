import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import PptxGenJS from "pptxgenjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Premium PowerPoint Generator v2
 *
 * Supports:
 * - Multiple slide layouts (title, content, two-column, image, chart, section-break)
 * - Dark premium theme matching Inceptive's design
 * - Speaker notes
 * - Charts (bar, line, pie)
 * - Gradient backgrounds
 * - Professional typography with proper spacing
 */

interface SlideData {
  layout?: "title" | "content" | "two-column" | "section-break" | "image" | "chart" | "blank";
  title?: string;
  subtitle?: string;
  content?: string;
  body?: string;
  text?: string;
  bullets?: string[];
  leftColumn?: string;
  rightColumn?: string;
  leftBullets?: string[];
  rightBullets?: string[];
  imageUrl?: string;
  imageCaption?: string;
  chartType?: "bar" | "line" | "pie";
  chartData?: { labels: string[]; values: number[]; seriesName?: string };
  speakerNotes?: string;
  accentColor?: string;
}

const COLORS = {
  bg: "0D0D0D",
  surface: "1A1A1A",
  border: "2A2A2A",
  accent: "0A84FF",
  accentSoft: "1A3A5C",
  text: "FFFFFF",
  textSecondary: "B0B0B0",
  textMuted: "707070",
  success: "30D158",
  warning: "FFD60A",
};

function addTitleSlide(pptx: PptxGenJS, slide: PptxGenJS.Slide, data: SlideData) {
  // Gradient background
  slide.background = { color: COLORS.bg };

  // Subtle accent line at top
  slide.addShape("rect" as any, {
    x: 0, y: 0, w: "100%", h: 0.04,
    fill: { color: data.accentColor || COLORS.accent },
  });

  // Main title
  if (data.title) {
    slide.addText(data.title, {
      x: 0.8, y: 1.5, w: "85%", h: 1.6,
      fontSize: 36, bold: true, color: COLORS.text,
      fontFace: "Helvetica Neue",
      lineSpacingMultiple: 1.1,
    });
  }

  // Subtitle
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 3.3, w: "85%", h: 0.8,
      fontSize: 18, color: COLORS.textSecondary,
      fontFace: "Helvetica Neue",
    });
  }

  // Bottom bar
  slide.addShape("rect" as any, {
    x: 0.8, y: 4.8, w: 1.5, h: 0.03,
    fill: { color: data.accentColor || COLORS.accent },
  });
}

function addContentSlide(slide: PptxGenJS.Slide, data: SlideData) {
  slide.background = { color: COLORS.bg };

  // Top accent line
  slide.addShape("rect" as any, {
    x: 0.8, y: 0, w: 0.5, h: 0.04,
    fill: { color: data.accentColor || COLORS.accent },
  });

  // Title
  if (data.title) {
    slide.addText(data.title, {
      x: 0.8, y: 0.4, w: "85%", h: 0.8,
      fontSize: 24, bold: true, color: COLORS.text,
      fontFace: "Helvetica Neue",
    });
  }

  // Body text
  const bodyText = data.content || data.body || data.text || "";
  if (bodyText) {
    slide.addText(bodyText, {
      x: 0.8, y: 1.4, w: "85%", h: 2.5,
      fontSize: 15, color: COLORS.textSecondary,
      fontFace: "Helvetica Neue",
      lineSpacingMultiple: 1.5,
      valign: "top",
    });
  }

  // Bullet points
  if (data.bullets && data.bullets.length > 0) {
    const bulletItems = data.bullets.map((b) => ({
      text: b,
      options: {
        fontSize: 14,
        color: COLORS.textSecondary,
        bullet: { type: "number" as const },
        breakLine: true,
        lineSpacingMultiple: 1.6,
        paraSpaceBefore: 4,
      },
    }));
    slide.addText(bulletItems, {
      x: 0.8, y: bodyText ? 3.2 : 1.4, w: "85%", h: 3,
      fontFace: "Helvetica Neue",
      valign: "top",
    });
  }
}

function addTwoColumnSlide(slide: PptxGenJS.Slide, data: SlideData) {
  slide.background = { color: COLORS.bg };

  if (data.title) {
    slide.addText(data.title, {
      x: 0.8, y: 0.4, w: "85%", h: 0.8,
      fontSize: 24, bold: true, color: COLORS.text,
      fontFace: "Helvetica Neue",
    });
  }

  // Left column
  const leftContent = data.leftColumn || "";
  if (leftContent || (data.leftBullets && data.leftBullets.length > 0)) {
    if (leftContent) {
      slide.addText(leftContent, {
        x: 0.8, y: 1.5, w: 5.5, h: 3.5,
        fontSize: 14, color: COLORS.textSecondary,
        fontFace: "Helvetica Neue",
        lineSpacingMultiple: 1.5,
        valign: "top",
      });
    }
    if (data.leftBullets) {
      const items = data.leftBullets.map((b) => ({
        text: b,
        options: { fontSize: 13, color: COLORS.textSecondary, bullet: true, breakLine: true, lineSpacingMultiple: 1.5 },
      }));
      slide.addText(items, {
        x: 0.8, y: leftContent ? 3 : 1.5, w: 5.5, h: 3,
        fontFace: "Helvetica Neue", valign: "top",
      });
    }
  }

  // Divider line
  slide.addShape("rect" as any, {
    x: 6.6, y: 1.5, w: 0.01, h: 3.5,
    fill: { color: COLORS.border },
  });

  // Right column
  const rightContent = data.rightColumn || "";
  if (rightContent || (data.rightBullets && data.rightBullets.length > 0)) {
    if (rightContent) {
      slide.addText(rightContent, {
        x: 7, y: 1.5, w: 5.5, h: 3.5,
        fontSize: 14, color: COLORS.textSecondary,
        fontFace: "Helvetica Neue",
        lineSpacingMultiple: 1.5,
        valign: "top",
      });
    }
    if (data.rightBullets) {
      const items = data.rightBullets.map((b) => ({
        text: b,
        options: { fontSize: 13, color: COLORS.textSecondary, bullet: true, breakLine: true, lineSpacingMultiple: 1.5 },
      }));
      slide.addText(items, {
        x: 7, y: rightContent ? 3 : 1.5, w: 5.5, h: 3,
        fontFace: "Helvetica Neue", valign: "top",
      });
    }
  }
}

function addSectionBreakSlide(slide: PptxGenJS.Slide, data: SlideData) {
  slide.background = { color: COLORS.surface };

  // Large centered text
  if (data.title) {
    slide.addText(data.title, {
      x: "10%", y: "30%", w: "80%", h: 1.5,
      fontSize: 32, bold: true, color: COLORS.text,
      fontFace: "Helvetica Neue",
      align: "center",
    });
  }

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: "15%", y: "55%", w: "70%", h: 0.6,
      fontSize: 16, color: COLORS.textMuted,
      fontFace: "Helvetica Neue",
      align: "center",
    });
  }

  // Accent bar centered
  slide.addShape("rect" as any, {
    x: "45%", y: "75%", w: "10%", h: 0.03,
    fill: { color: data.accentColor || COLORS.accent },
  });
}

function addChartSlide(pptx: PptxGenJS, slide: PptxGenJS.Slide, data: SlideData) {
  slide.background = { color: COLORS.bg };

  if (data.title) {
    slide.addText(data.title, {
      x: 0.8, y: 0.4, w: "85%", h: 0.7,
      fontSize: 22, bold: true, color: COLORS.text,
      fontFace: "Helvetica Neue",
    });
  }

  if (data.chartData && data.chartData.labels && data.chartData.values) {
    const chartType = data.chartType === "line" ? pptx.ChartType.line
      : data.chartType === "pie" ? pptx.ChartType.pie
      : pptx.ChartType.bar;

    slide.addChart(chartType, [
      {
        name: data.chartData.seriesName || "Data",
        labels: data.chartData.labels,
        values: data.chartData.values,
      },
    ], {
      x: 0.8, y: 1.3, w: 11, h: 4,
      showTitle: false,
      showLegend: true,
      legendPos: "b",
      legendFontSize: 10,
      legendColor: COLORS.textSecondary,
      catAxisLabelColor: COLORS.textMuted,
      valAxisLabelColor: COLORS.textMuted,
      chartColors: [COLORS.accent, COLORS.success, COLORS.warning, "FF6B6B", "C084FC"],
    });
  }
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
    const {
      slides,
      title = "Presentation",
      filename = "presentation.pptx",
    }: { slides: SlideData[]; title: string; filename: string } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json({ error: "Invalid or empty slides array" }, { status: 400 });
    }

    const pptx = new PptxGenJS();
    pptx.title = title;
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Inceptive AI";

    for (const slideData of slides) {
      const slide = pptx.addSlide();
      const layout = slideData.layout || (slideData.chartData ? "chart" : slideData.leftColumn || slideData.rightColumn ? "two-column" : "content");

      switch (layout) {
        case "title":
          addTitleSlide(pptx, slide, slideData);
          break;
        case "two-column":
          addTwoColumnSlide(slide, slideData);
          break;
        case "section-break":
          addSectionBreakSlide(slide, slideData);
          break;
        case "chart":
          addChartSlide(pptx, slide, slideData);
          break;
        default:
          addContentSlide(slide, slideData);
      }

      // Speaker notes
      if (slideData.speakerNotes) {
        slide.addNotes(slideData.speakerNotes);
      }

      // Slide number (bottom right)
      slide.addText(`${slides.indexOf(slideData) + 1}`, {
        x: 12, y: 5.2, w: 0.5, h: 0.3,
        fontSize: 9, color: COLORS.textMuted,
        fontFace: "Helvetica Neue",
        align: "right",
      });
    }

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
  return NextResponse.json({ message: "Premium PowerPoint API v2 - use POST with slides array" });
}
