"use client";

import React, { useCallback, useRef, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";

/**
 * TTS "Listen" button that uses the browser's native Web Speech API.
 * Zero API keys needed. Works in Chrome, Edge, Safari, Firefox.
 */
export function TTSButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handlePlay = useCallback(() => {
    if (!("speechSynthesis" in window)) {
      alert("Your browser doesn't support text-to-speech.");
      return;
    }

    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    // Clean the text: strip markdown, code blocks, etc.
    const cleaned = text
      .replace(/```[\s\S]*?```/g, "") // remove code blocks
      .replace(/\*\*(.*?)\*\*/g, "$1") // bold
      .replace(/\*(.*?)\*/g, "$1") // italic
      .replace(/#{1,6}\s/g, "") // headings
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
      .replace(/[`~>|]/g, "") // misc markdown
      .trim();

    if (!cleaned) return;

    setLoading(true);
    const utterance = new SpeechSynthesisUtterance(cleaned.slice(0, 5000));
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to pick a nice English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel"))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setLoading(false);
      setPlaying(true);
    };
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => {
      setLoading(false);
      setPlaying(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [text, playing]);

  return (
    <button
      onClick={handlePlay}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
      title={playing ? "Stop" : "Listen"}
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : playing ? (
        <Square size={13} />
      ) : (
        <Volume2 size={13} />
      )}
      {playing ? "Stop" : "Listen"}
    </button>
  );
}
