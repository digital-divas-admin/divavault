"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Search,
  Eye,
  MessageSquare,
  Crosshair,
  Megaphone,
  Loader2,
} from "lucide-react";

interface PipelineStatus {
  pendingAds: number;
  processingAds: number;
  undescribedFaces: number;
  unsearchedFaces: number;
  unmatchedFaces: number;
  runningJobs: number;
}

const STAGES = [
  {
    key: "discover",
    label: "Discover",
    icon: Megaphone,
    getCount: (s: PipelineStatus) => s.pendingAds,
    description: "pending ads",
  },
  {
    key: "detect",
    label: "Detect",
    icon: Eye,
    getCount: (s: PipelineStatus) => s.processingAds,
    description: "processing",
  },
  {
    key: "describe",
    label: "Describe",
    icon: MessageSquare,
    getCount: (s: PipelineStatus) => s.undescribedFaces,
    description: "undescribed",
  },
  {
    key: "search",
    label: "Search",
    icon: Search,
    getCount: (s: PipelineStatus) => s.unsearchedFaces,
    description: "unsearched",
  },
  {
    key: "match",
    label: "Match",
    icon: Crosshair,
    getCount: (s: PipelineStatus) => s.unmatchedFaces,
    description: "unmatched",
  },
] as const;

export function PipelineStatusCard() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ad-intel/pipeline-status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Silently fail — will retry on next poll
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Pipeline Queue</CardTitle>
          {status.runningJobs > 0 && (
            <Badge variant="purple" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {status.runningJobs} running
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-1">
          {STAGES.map((stage, i) => {
            const count = stage.getCount(status);
            const hasWork = count > 0;
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex items-center flex-1 min-w-0">
                <div
                  className={`flex-1 rounded-lg border p-3 text-center transition-colors ${
                    hasWork
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/20 bg-card"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 mx-auto mb-1 ${
                      hasWork ? "text-primary" : "text-muted-foreground/50"
                    }`}
                  />
                  <p
                    className={`text-lg font-bold ${
                      hasWork ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    {count}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {stage.description}
                  </p>
                </div>
                {i < STAGES.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-0.5 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
