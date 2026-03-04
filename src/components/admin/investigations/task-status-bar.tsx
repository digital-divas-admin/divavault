"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { DeepfakeTask } from "@/types/investigations";

interface TaskStatusBarProps {
  tasks: DeepfakeTask[];
  investigationId: string;
  onUpdate: () => void;
}

export function TaskStatusBar({ tasks, investigationId, onUpdate }: TaskStatusBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const prevStatusRef = useRef<string>("");

  // Poll for task updates every 15 seconds — only refresh parent when status changes
  useEffect(() => {
    if (dismissed) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/investigations/${investigationId}/tasks`);
        if (!res.ok) return;
        const updated = await res.json();
        const stillActive = updated.some(
          (t: DeepfakeTask) => t.status === "pending" || t.status === "running"
        );

        // Build a fingerprint of task statuses + progress to detect actual changes
        const statusKey = updated
          .map((t: DeepfakeTask) => `${t.id}:${t.status}:${t.progress ?? 0}`)
          .sort()
          .join(",");

        if (statusKey !== prevStatusRef.current) {
          prevStatusRef.current = statusKey;
          onUpdate();
        }

        if (!stillActive) {
          clearInterval(interval);
        }
      } catch {
        // Network error — skip this poll cycle
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [investigationId, onUpdate, dismissed]);

  if (dismissed) return null;

  const running = tasks.filter((t) => t.status === "running");
  const pending = tasks.filter((t) => t.status === "pending");
  const avgProgress =
    running.length > 0
      ? Math.round(running.reduce((sum, t) => sum + (t.progress || 0), 0) / running.length)
      : 0;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 flex items-center gap-3">
      <Loader2 className="h-4 w-4 text-primary animate-spin" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground font-medium">
            {running.length > 0
              ? `Processing ${running.length} task${running.length > 1 ? "s" : ""}`
              : `${pending.length} task${pending.length > 1 ? "s" : ""} queued`}
          </span>
          {avgProgress > 0 && (
            <span className="text-muted-foreground text-xs">{avgProgress}%</span>
          )}
        </div>
        {avgProgress > 0 && (
          <div className="w-full h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${avgProgress}%` }}
            />
          </div>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
