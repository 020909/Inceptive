import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hugging Face Inference API endpoint for text-to-image
// Using Stability AI model which is more reliable on free tier
const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";

// Alternative models to try if the first one fails
const FALLBACK_MODELS = [
  "runwayml/stable-diffusion-v1-5",
  "CompVis/stable-diffusion-v1-4",
];

export async function POST(req: Request) {
  // Try auth header first, then accept user_id from body (for internal agent calls)
  let userId = await getAuthenticatedUserIdFromRequest(req);
  
  if (!userId) {
    // Check if user_id is passed in body (from internal agent calls)
    const bodyClone = await req.clone().json().catch(() => ({}));
    userId = bodyClone.user_id;
  }
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { prompt, model, width = 1024, height = 1024, num_inference_steps = 20, guidance_scale = 3.5, user_id: passedUserId } = body;
    
    // Use passed user_id if present (internal agent call)
    const effectiveUserId = passedUserId || userId;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    const hfToken = process.env.HUGGING_FACE_API_KEY?.trim();
    if (!hfToken) {
      return NextResponse.json(
        { error: "HUGGING_FACE_API_KEY not configured. Add it in Vercel env variables." },
        { status: 501 }
      );
    }

    // Try primary model first
    let result = await generateImage(hfToken, HF_API_URL, prompt, width, height, num_inference_steps, guidance_scale);
    
    // Try fallback models if primary fails
    if (!result.success && result.error) {
      for (const fallbackModel of FALLBACK_MODELS) {
        const fallbackUrl = `https://api-inference.huggingface.co/models/${fallbackModel}`;
        result = await generateImage(hfToken, fallbackUrl, prompt, width, height, num_inference_steps, guidance_scale);
        if (result.success) break;
      }
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Image generation failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      image: result.image,
      prompt,
      model: "FLUX.1-schnell",
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
          width,
          height,
          num_inference_steps,
          guidance_scale,
        },
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout for image generation
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HF API error: ${response.status} - ${errorText}` };
    }

    // Response is a binary image - convert to base64
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    
    // Determine content type
    const contentType = response.headers.get("content-type") || "image/png";
    
    return {
      success: true,
      image: `data:${contentType};base64,${base64}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Request failed" };
  }
}

// Simple GET endpoint for testing
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt") || "A beautiful sunset over the ocean";

  return NextResponse.json({
    message: "Use POST method with {prompt: 'your prompt'} to generate images",
    example: {
      prompt: "A cute cat sitting on a chair",
      width: 1024,
      height: 1024,
    },
  });
}
