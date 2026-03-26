"use client";

import { useState } from "react";
import puter from "@heyputer/puter.js";

export default function PuterTest() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse("");

    try {
      const reply = await puter.ai.chat(prompt, {
        model: "claude-opus-4-6"   // ← Full powerful Opus 4.6 for free
      });
      const content = reply.message?.content as any;
      const text = Array.isArray(content) && content[0] && typeof content[0] === 'object' && 'text' in content[0] 
        ? content[0].text 
        : "No text returned";
      setResponse(text);
    } catch (err) {
      console.error(err);
      setResponse("First time it will ask you to sign in with Puter (free, 10 seconds). After that it's instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ color: "#00ff9d" }}>✅ Inceptive + Claude Opus 4.6 (Free via Puter)</h1>
      <p>Type anything below and click Send</p>
      
      <textarea
        rows={5}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Example: Help me design the credit system for Inceptive"
        style={{ width: "100%", padding: "1rem", fontSize: "1.1rem" }}
      />
      
      <br /><br />
      <button 
        onClick={handleAsk} 
        disabled={loading}
        style={{ padding: "1rem 2rem", fontSize: "1.2rem", background: "#00ff9d", color: "black", border: "none", cursor: "pointer" }}
      >
        {loading ? "Opus 4.6 is thinking..." : "Send to Opus 4.6"}
      </button>

      {response && (
        <div style={{ marginTop: "3rem", padding: "1.5rem", background: "#111", borderRadius: "8px", whiteSpace: "pre-wrap" }}>
          <strong>Opus 4.6 answered:</strong>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}