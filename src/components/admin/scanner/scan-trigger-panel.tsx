"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, ScanSearch, Crown } from "lucide-react";
import type { SelectedContributor } from "./contributor-picker";

interface ScheduleRow {
  contributor_id: string;
  scan_type: string;
  last_scan_at: string | null;
  next_scan_at: string | null;
  scan_interval_hours: number;
  priority: number;
}

interface ScanTriggerPanelProps {
  contributor: SelectedContributor;
}

const tierColors: Record<string, string> = {
  free: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  protected: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  premium: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export function ScanTriggerPanel({ contributor }: ScanTriggerPanelProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [changingTier, setChangingTier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState(contributor.tier);

  useEffect(() => {
    setCurrentTier(contributor.tier);
  }, [contributor.tier]);

  useEffect(() => {
    let cancelled = false;

    async function loadSchedules() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/scanner/scan-schedule?contributorId=${encodeURIComponent(contributor.id)}`
        );
        if (!res.ok) throw new Error("Failed to fetch schedules");
        const data = await res.json();
        if (!cancelled) setSchedules(data.schedules || []);
      } catch {
        if (!cancelled) setSchedules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSchedules();
    return () => {
      cancelled = true;
    };
  }, [contributor.id]);

  async function handleTrigger(scanType?: string) {
    setTriggering(scanType || "all");
    setError(null);
    try {
      const body: Record<string, unknown> = { contributorId: contributor.id };
      if (scanType) body.scanType = scanType;

      const res = await fetch("/api/admin/scanner/trigger-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Trigger failed");
      }

      // Refresh schedules
      const schedRes = await fetch(
        `/api/admin/scanner/scan-schedule?contributorId=${encodeURIComponent(contributor.id)}`
      );
      if (schedRes.ok) {
        const data = await schedRes.json();
        setSchedules(data.schedules || []);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setTriggering(null);
    }
  }

  async function handleTierChange(tier: string) {
    setChangingTier(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scanner/change-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributorId: contributor.id, tier }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Tier change failed");
      }

      setCurrentTier(tier);

      // Refresh schedules
      const schedRes = await fetch(
        `/api/admin/scanner/scan-schedule?contributorId=${encodeURIComponent(contributor.id)}`
      );
      if (schedRes.ok) {
        const data = await schedRes.json();
        setSchedules(data.schedules || []);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tier change failed");
    } finally {
      setChangingTier(false);
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
          <ScanSearch className="h-4 w-4 text-blue-500" />
          Scan Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tier selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Crown className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Tier:</span>
          </div>
          <Select value={currentTier} onValueChange={handleTierChange} disabled={changingTier}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="protected">Protected</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
          {changingTier && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : schedules.length > 0 ? (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div
                key={s.scan_type}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/20 bg-accent/20"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.scan_type.replace(/_/g, " ")}</p>
                    <Badge variant="outline" className={tierColors[currentTier] || ""}>
                      every {s.scan_interval_hours}h
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Next: {formatDate(s.next_scan_at)} | Last: {formatDate(s.last_scan_at)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTrigger(s.scan_type)}
                  disabled={triggering === s.scan_type}
                >
                  {triggering === s.scan_type ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No scan schedules found for this contributor.
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => handleTrigger()}
          disabled={triggering === "all"}
        >
          {triggering === "all" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Play className="h-4 w-4 mr-2" />
          Trigger All Scan Types Now
        </Button>
      </CardContent>
    </Card>
  );
}
