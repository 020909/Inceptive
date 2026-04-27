"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MousePointerClick, Type, Scroll, Camera, MoveRight, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type Action = "goto" | "click" | "type" | "scroll" | "moveMouse" | "screenshot";

export function ComputerUsePanel() {
  const { session } = useAuth();
  const [sessionId, setSessionId] = useState("default");
  const [url, setUrl] = useState("https://news.ycombinator.com");
  const [text, setText] = useState("");
  const [x, setX] = useState(200);
  const [y, setY] = useState(200);
  const [deltaY, setDeltaY] = useState(600);
  const [requireApproval, setRequireApproval] = useState(true);
  const [loading, setLoading] = useState<Action | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [vision, setVision] = useState<string>("");

  const run = async (action: Action, params: Record<string, unknown>) => {
    if (!session?.access_token) {
      toast.error("Please sign in");
      return;
    }
    setLoading(action);
    try {
      const res = await fetch("/api/computer/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          session_id: sessionId,
          action,
          params: requireApproval && action !== "screenshot" ? { ...params, approved: true } : params,
          require_approval: requireApproval,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setPreview(d.screenshot || null);
      setVision(d.vision || "");
      toast.success(`Computer action: ${action}`);
    } catch (e: any) {
      toast.error(e.message || "Computer action failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--fg-primary)]">Computer Use (Browser Control)</p>
        <label className="text-xs text-[var(--fg-tertiary)] flex items-center gap-2">
          <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
          Require approval
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Session</Label>
          <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run("goto", { url })} disabled={!!loading} className="text-xs">
          {loading === "goto" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <MoveRight className="h-3.5 w-3.5 mr-1" />}
          Go to URL
        </Button>
        <Button onClick={() => run("screenshot", {})} disabled={!!loading} variant="default" className="text-xs">
          {loading === "screenshot" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
          Screenshot
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Input type="number" value={x} onChange={(e) => setX(Number(e.target.value))} placeholder="x" />
        <Input type="number" value={y} onChange={(e) => setY(Number(e.target.value))} placeholder="y" />
        <Button onClick={() => run("click", { x, y })} disabled={!!loading} variant="default" className="text-xs">
          <MousePointerClick className="h-3.5 w-3.5 mr-1" />
          Click
        </Button>
        <Button onClick={() => run("moveMouse", { x, y })} disabled={!!loading} variant="default" className="text-xs">
          Move
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type text..." className="md:col-span-3" />
        <Button onClick={() => run("type", { text })} disabled={!!loading || !text.trim()} variant="default" className="text-xs">
          <Type className="h-3.5 w-3.5 mr-1" />
          Type
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input type="number" value={deltaY} onChange={(e) => setDeltaY(Number(e.target.value))} placeholder="Scroll deltaY" className="md:col-span-3" />
        <Button onClick={() => run("scroll", { deltaY })} disabled={!!loading} variant="default" className="text-xs">
          <Scroll className="h-3.5 w-3.5 mr-1" />
          Scroll
        </Button>
      </div>

      {requireApproval && (
        <div className="text-[11px] text-[var(--fg-tertiary)] flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          Safety mode is enabled.
        </div>
      )}

      {preview && (
        <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
          <img src={`data:image/png;base64,${preview}`} alt="Computer preview" className="w-full h-auto" />
        </div>
      )}
      {vision && <p className="text-xs text-[var(--fg-secondary)] whitespace-pre-wrap">{vision}</p>}
    </div>
  );
}

