import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// New HF Router endpoint (api-inference.huggingface.co is deprecated/410)
const HF_ROUTER_URL = "https://router.huggingface.co/hf-inference/models";

// Models to try in order — FLUX.1-schnell is fast and free-tier friendly
const MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "runwayml/stable-diffusion-v1-5",
];

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
    const { prompt, width = 1024, height = 1024, num_inference_steps = 4, guidance_scale = 3.5 } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    const hfToken = process.env.HUGGING_FACE_API_KEY?.trim();
    if (!hfToken) {
      return NextResponse.json(
        { error: "HUGGING_FACE_API_KEY not configured." },
        { status: 501 }
      );
    }

    let result: { success: boolean; image?: string; error?: string } = { success: false };

    for (const model of MODELS) {
      const apiUrl = `${HF_ROUTER_URL}/${model}`;
      result = await generateImage(hfToken, apiUrl, prompt, width, height, num_inference_steps, guidance_scale);
      if (result.success) break;
      console.log(`[ImageGen] Model ${model} failed: ${result.error}, trying next...`);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Image generation failed" }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      image: result.image,
      prompt,
      width,
      height,
    });
  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate image" }, { status: 500 });
  }
}

async function generateImage(
  token: string,
  apiUrl: string,
  prompt: string,
  width: number,
  height: number,
  num_inference_steps: number,
  guidance_scale: number
): Promise<{ success: boolean; image?: string; error?: string }> {
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: Math.min(width, 1024),
          height: Math.min(height, 1024),
          num_inference_steps,
          guidance_scale,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { success: false, error: `HF API error: ${response.status} - ${errorText.slice(0, 200)}` };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";

    return {
      success: true,
      image: `data:${contentType};base64,${base64}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Request failed" };
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST method with {prompt: 'your prompt'} to generate images",
    example: { prompt: "A cute cat sitting on a chair", width: 1024, height: 1024 },
  });
}
