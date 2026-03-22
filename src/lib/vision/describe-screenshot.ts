import Anthropic from "@anthropic-ai/sdk";

/**
 * Vision caption for computer-use — uses the same key the user configured in Settings.
 */
export async function describeScreenshotBase64(
  apiKey: string,
  provider: string,
  base64Png: string
): Promise<string> {
  const p = (provider || "").toLowerCase();

  if (p === "openai" || p === "openrouter") {
    const baseUrl =
      p === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(p === "openrouter"
          ? {
              "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000",
              "X-Title": "Inceptive",
            }
          : {}),
      },
      body: JSON.stringify({
        model: p === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this browser screenshot briefly: main UI, key buttons, and what the user could do next (3–5 short bullets).",
              },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${base64Png}` },
              },
            ],
          },
        ],
      }),
    });
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(j.error?.message || "OpenAI vision failed");
    return j.choices?.[0]?.message?.content || "";
  }

  if (p === "claude" || p === "anthropic") {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this browser screenshot briefly (3–5 bullets): visible page, controls, suggested next action.",
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Png,
              },
            },
          ],
        },
      ],
    });
    const block = msg.content[0];
    if (block.type === "text") return block.text;
    return "";
  }

  if (p === "gemini" || p === "google") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      "Describe this browser screenshot in 3–5 short bullets.",
      { inlineData: { mimeType: "image/png", data: base64Png } },
    ]);
    return result.response.text();
  }

  return "Vision not configured for this provider; connect OpenAI, Anthropic, or Google in Settings.";
}
