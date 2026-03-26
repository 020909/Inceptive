"use client";

import { useState } from "react";
import puter from "@heyputer/puter.js";

export default function PuterTest() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setResponse("");

    try {
      const reply = await puter.ai.chat(prompt, {
        model: "claude-opus-4-6"
      });
      const content = reply?.message?.content as any;
      const text = Array.isArray(content) && content[0] && typeof content[0] === 'object' && 'text' in content[0] 
        ? content[0].text 
        : "No response";
      setResponse(text);
    } catch (err: any) {
      console.error(err);
      setResponse("First time: Click the sign-in popup (free Puter account). Then try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ color: "#00ff9d" }}>Inceptive + Claude Opus 4.6 (Free via Puter)</h1>
      <p>Type a prompt and click Send</p>
      
      <textarea
        rows={6}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Example: Help me build the credit system for Inceptive"
        style={{ width: "100%", padding: "12px", fontSize: "16px" }}
      />
      
      <br /><br />
      <button 
        onClick={handleAsk}
        disabled={loading}
        style={{ 
          padding: "14px 28px", 
          fontSize: "18px", 
          background: loading ? "#666" : "#00ff9d", 
          color: "black", 
          border: "none", 
          borderRadius: "6px",
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Opus 4.6 thinking..." : "Send to Opus 4.6"}
      </button>

      {response && (
        <div style={{ marginTop: "30px", padding: "20px", background: "#1a1a1a", borderRadius: "8px", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
          <strong>Opus 4.6 Response:</strong><br /><br />
          {response}
        </div>
      )}
    </div>
  );
}