import "server-only";

import { generateText } from "ai";
import { buildModel } from "@/lib/ai-model";

export type SupportedMimeType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function parseDocumentToText(opts: {
  mimeType: string;
  bytes: ArrayBuffer;
}): Promise<{ text: string; citations: Array<{ page: number | null; excerpt: string }> }> {
  const mimeType = (opts.mimeType || "").toLowerCase().trim();
  const bytes = opts.bytes;

  if (mimeType === "application/pdf") {
    const mod: any = await import("pdf-parse");
    const pdfParse: any = mod?.default || mod;
    const result = await pdfParse(Buffer.from(bytes));
    const text = (result?.text || "").trim();
    return {
      text,
      citations: text
        ? [
            {
              page: null,
              excerpt: text.slice(0, 500),
            },
          ]
        : [],
    };
  }

  if (mimeType === "image/png" || mimeType === "image/jpeg") {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Missing OPENROUTER_API_KEY (required for image parsing)");
    }

    const model = buildModel(
      apiKey,
      "openrouter",
      process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini"
    );
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const { text } = await generateText({
      model,
      temperature: 0,
      system:
        "You extract text from uploaded KYB/UBO documents. Return ONLY the raw text you can read from the image. Preserve line breaks where possible. Do not add commentary.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all readable text from this image. Output only the extracted text.",
            },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });

    const cleaned = (text || "").trim();
    return {
      text: cleaned,
      citations: cleaned
        ? [
            {
              page: null,
              excerpt: cleaned.slice(0, 500),
            },
          ]
        : [],
    };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // DOCX parsing is intentionally not implemented yet (would require a zip/docx parser dependency).
    throw new Error("DOCX parsing is not supported yet");
  }

  throw new Error(`Unsupported mimeType: ${mimeType}`);
}

