"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Play, Globe } from "lucide-react";

interface CrawlSchedule {
  platform: string;
  last_crawl_at: string | null;
  next_crawl_at: string | null;
  crawl_interval_hours: number;
  enabled: boolean;
}

interface CrawlSchedulesPanelProps {
  initialSchedules: CrawlSchedule[];
}

export function CrawlSchedulesPanel({ initialSchedules }: CrawlSchedulesPanelProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<CrawlSchedule[]>(initialSchedules);
  const [toggling, setToggling] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(platform: string, enabled: boolean) {
    setToggling(platform);
    setError(null);
    try {
      const res = await fetch("/api/admin/scanner/toggle-crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Toggle failed");
      }

      setSchedules((prev) =>
        prev.map((s) => (s.platform === platform ? { ...s, enabled } : s))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setToggling(null);
    }
  }

  async function handleTrigger(platform: string) {
    setTriggering(platform);
    setError(null);
    try {
      const res = await fetch("/api/admin/scanner/trigger-crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Trigger failed");
      }

      setSchedules((prev) =>
        prev.map((s) =>
          s.platform === platform
            ? { ...s, next_crawl_at: new Date().toISOString() }
            : s
        )
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setTriggering(null);
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "Never";
    return new Date(d).toLocaleString();
  }

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-purple-500" />
          Platform Crawl Schedules
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No crawl schedules configured. Add platforms to the
            platform_crawl_schedule table to see them here.
          </p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div
                key={s.platform}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/20 bg-accent/20"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.platform}</p>
                    <Badge
                      variant="outline"
                      className={
                        s.enabled
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                      }
                    >
                      {s.enabled ? "Active" : "Disabled"}
                    </Badge>
                    <Badge variant="outline">every {s.crawl_interval_hours}h</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Next: {formatDate(s.next_crawl_at)} | Last: {formatDate(s.last_crawl_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(checked) => handleToggle(s.platform, checked)}
                    disabled={toggling === s.platform}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTrigger(s.platform)}
                    disabled={triggering === s.platform}
                  >
                    {triggering === s.platform ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
