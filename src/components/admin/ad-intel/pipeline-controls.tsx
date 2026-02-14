"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play,
  Loader2,
  CheckCircle2,
  Megaphone,
  Eye,
  MessageSquare,
  Search,
  Crosshair,
} from "lucide-react";

const STAGES = [
  { key: "discover", label: "Discover", icon: Megaphone },
  { key: "detect", label: "Detect", icon: Eye },
  { key: "describe", label: "Describe", icon: MessageSquare },
  { key: "search", label: "Search", icon: Search },
  { key: "match", label: "Match", icon: Crosshair },
] as const;

export function PipelineControls() {
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const triggerScan = async (stage?: string) => {
    const key = stage || "full";
    setLoading(key);
    setSuccess(null);

    try {
      const body = stage ? JSON.stringify({ stage }) : "{}";
      const res = await fetch("/api/admin/ad-intel/trigger-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.ok) {
        setSuccess(key);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      // Error silently handled
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Pipeline Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => triggerScan()}
          disabled={loading !== null}
          className="w-full"
        >
          {loading === "full" ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : success === "full" ? (
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {success === "full" ? "Pipeline Triggered" : "Run Full Pipeline"}
        </Button>

        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Or trigger individual stages:
          </p>
          <div className="grid grid-cols-5 gap-2">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              const isLoading = loading === stage.key;
              const isSuccess = success === stage.key;

              return (
                <Button
                  key={stage.key}
                  variant="outline"
                  size="sm"
                  onClick={() => triggerScan(stage.key)}
                  disabled={loading !== null}
                  className="flex-col h-auto py-2 gap-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isSuccess ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="text-[10px]">{stage.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
