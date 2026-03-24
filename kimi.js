const fs = require("fs");

const apiKey = "Bearer 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";

async function run() {
  const code = fs.readFileSync("./src/app/page.tsx", "utf-8");

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "moonshotai/kimi-k2.5",
      messages: [
        {
          role: "user",
          content: "Fix and improve this code:\n" + code
        }
      ]
    })
  });

  const data = await res.json();
  console.log(data.choices[0].message.content);
}

run();
