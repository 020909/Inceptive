"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface RunAgentButtonProps {
  orgId: string;
  orgSlug: string;
  userId: string;
  userEmail: string;
  userName: string;
}

export function RunAgentButton({ orgId, orgSlug, userId, userEmail, userName }: RunAgentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/trigger-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgId,
          orgSlug,
          userId,
          userEmail,
          userName,
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json.error || "Failed to trigger agent run.");
      }

      if (response.status === 202 || json.requiresApproval || json.queued) {
        toast.success("Run submitted for approval. A workspace admin needs to review it first.");
        return;
      }

      toast.success("Your AI agent is running. Check back in a few minutes for results.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to trigger agent run.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button size="lg" className="h-11 rounded-xl px-5" onClick={handleClick} disabled={isLoading}>
      {isLoading ? <Loader2 className="animate-spin" /> : null}
      {isLoading ? "Running..." : "Run Agent Now"}
    </Button>
  );
}
