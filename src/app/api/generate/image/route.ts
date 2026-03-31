import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Primary: Pollinations.ai (free, no API key needed)
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

// Fallback: HF Router (needs valid token with inference permissions)
const HF_ROUTER_URL = "https://router.huggingface.co/hf-inference/models";
const HF_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
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
    const { prompt, width = 1024, height = 1024 } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    // ── Try Pollinations.ai first (free, no key) ──
    const pollinationsResult = await generateViaPollinations(prompt, width, height);
    if (pollinationsResult.success) {
      return NextResponse.json({
        status: "success",
        image: pollinationsResult.image,
        prompt,
        width,
        height,
      });
    }

    // ── Fallback to HF Router ──
    const hfToken = process.env.HUGGING_FACE_API_KEY?.trim();
    if (hfToken) {
      for (const model of HF_MODELS) {
        const result = await generateViaHF(hfToken, `${HF_ROUTER_URL}/${model}`, prompt, width, height);
        if (result.success) {
          return NextResponse.json({
            status: "success",
            image: result.image,
            prompt,
            width,
            height,
          });
        }
        console.log(`[ImageGen] HF model ${model} failed: ${result.error}`);
      }
    }

    return NextResponse.json(
      { error: pollinationsResult.error || "Image generation failed. Please try again." },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate image" }, { status: 500 });
  }
}

async function generateViaPollinations(
  prompt: string,
  width: number,
  height: number
): Promise<{ success: boolean; image?: string; error?: string }> {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${POLLINATIONS_URL}/${encodedPrompt}?width=${Math.min(width, 1024)}&height=${Math.min(height, 1024)}&nologo=true&seed=${Date.now()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    if (!response.ok) {
      return { success: false, error: `Pollinations error: ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 1000) {
      return { success: false, error: "Generated image too small" };
    }

    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return {
      success: true,
      image: `data:${contentType};base64,${base64}`,
    };
  } catch (error: any) {
    return { success: false, error: `Pollinations: ${error.message}` };
  }
}

async function generateViaHF(
  token: string,
  apiUrl: string,
  prompt: string,
  width: number,
  height: number
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
          num_inference_steps: 4,
          guidance_scale: 3.5,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { success: false, error: `HF ${response.status}: ${errorText.slice(0, 200)}` };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";

    return {
      success: true,
      image: `data:${contentType};base64,${base64}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST method with {prompt: 'your prompt'} to generate images",
  });
}
