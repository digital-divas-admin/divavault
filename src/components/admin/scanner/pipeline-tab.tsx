"use client";

import type { CommandCenterData, PlatformInfo } from "@/lib/scanner-command-queries";
import { Card, CardContent } from "@/components/ui/card";
import {
  Image,
  ScanFace,
  Fingerprint,
  ClipboardCheck,
  ArrowRight,
  AlertTriangle,
  Cpu,
  Monitor,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PipelineTabProps {
  data: CommandCenterData;
  health: Record<string, any> | null;
  platforms: PlatformInfo[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function backlogBadge(count: number, amberThreshold: number, redThreshold: number) {
  if (count >= redThreshold) return "bg-red-500/10 text-red-400";
  if (count >= amberThreshold) return "bg-yellow-500/10 text-yellow-400";
  return "bg-muted/30 text-muted-foreground";
}

// --- Pipeline Stage Cards ---

function PipelineStageCards({
  data,
  health,
}: {
  data: CommandCenterData;
  health: Record<string, any> | null;
}) {
  const m = health?.metrics || {};

  const stages = [
    {
      label: "Discovered",
      icon: Image,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      total: data.funnel.discovered,
      pending: null as number | null,
      throughput24h: m.images_discovered_24h ?? null,
    },
    {
      label: "Face Detection",
      icon: ScanFace,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/30",
      total: data.funnel.withFaces,
      pending: m.images_pending_detection ?? data.pipeline.pendingDetectionCount,
      throughput24h: m.faces_detected_24h ?? null,
    },
    {
      label: "Matching",
      icon: Fingerprint,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      total: data.funnel.compared,
      pending: m.faces_pending_matching ?? data.pipeline.pendingMatchingCount,
      throughput24h: m.faces_matched_24h ?? null,
    },
    {
      label: "Review",
      icon: ClipboardCheck,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      total: data.funnel.matched,
      pending: m.matches_pending_review ?? data.pipeline.matchesPendingReviewCount,
      throughput24h: m.matches_found_24h ?? null,
    },
  ];

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-3">
        Pipeline Stages
      </h3>
      <div className="flex items-stretch gap-2">
        {stages.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-stretch gap-2 flex-1 min-w-0">
              <Card className={`flex-1 bg-card border-border/30 ${s.border}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`rounded-full p-1.5 ${s.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                    </div>
                    <span className="text-xs font-medium">{s.label}</span>
                  </div>
                  <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                    {(s.total ?? 0).toLocaleString()}
                  </p>
                  {s.pending !== null && (
                    <div className="mt-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-[family-name:var(--font-mono)] ${backlogBadge(s.pending, 100, 1000)}`}
                      >
                        {s.pending.toLocaleString()} pending
                      </span>
                    </div>
                  )}
                  {s.throughput24h !== null && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {s.throughput24h.toLocaleString()} / 24h
                    </p>
                  )}
                </CardContent>
              </Card>
              {i < stages.length - 1 && (
                <div className="flex items-center shrink-0">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Backlog Alerts ---

function BacklogAlerts({
  data,
  health,
}: {
  data: CommandCenterData;
  health: Record<string, any> | null;
}) {
  const m = health?.metrics || {};
  const pendingDetection = m.images_pending_detection ?? data.pipeline.pendingDetectionCount;
  const pendingMatching = m.faces_pending_matching ?? data.pipeline.pendingMatchingCount;
  const pendingReview = m.matches_pending_review ?? data.pipeline.matchesPendingReviewCount;

  const alerts: { label: string; count: number; threshold: number; severity: "amber" | "red" }[] = [];

  if (pendingDetection > 500) {
    alerts.push({
      label: "Face detection backlog",
      count: pendingDetection,
      threshold: 500,
      severity: pendingDetection > 2000 ? "red" : "amber",
    });
  }
  if (pendingMatching > 500) {
    alerts.push({
      label: "Matching backlog",
      count: pendingMatching,
      threshold: 500,
      severity: pendingMatching > 2000 ? "red" : "amber",
    });
  }
  if (pendingReview > 20) {
    alerts.push({
      label: "Matches awaiting review",
      count: pendingReview,
      threshold: 20,
      severity: pendingReview > 50 ? "red" : "amber",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Card
          key={a.label}
          className={`border-border/30 ${
            a.severity === "red" ? "bg-red-500/5 border-red-500/20" : "bg-yellow-500/5 border-yellow-500/20"
          }`}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle
              className={`h-4 w-4 shrink-0 ${
                a.severity === "red" ? "text-red-400" : "text-yellow-400"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">
                {a.count.toLocaleString()} items queued
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-[family-name:var(--font-mono)] ${
                a.severity === "red"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-yellow-500/10 text-yellow-400"
              }`}
            >
              {a.severity === "red" ? "HIGH" : "WARN"}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Compute Status ---

function ComputeStatus({ health }: { health: Record<string, any> | null }) {
  const compute = health?.compute;

  if (!compute) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Compute Status
          </h3>
          <p className="text-xs text-muted-foreground">
            Waiting for scanner health data...
          </p>
        </CardContent>
      </Card>
    );
  }

  const isCpu = compute.execution_provider === "CPUExecutionProvider";
  const gpuAvailable = compute.gpu_available;

  return (
    <Card className="bg-card border-border/30">
      <CardContent className="p-4">
        <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          Compute Status
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Face Detection</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isCpu
                  ? "bg-yellow-500/10 text-yellow-400"
                  : "bg-green-500/10 text-green-400"
              }`}
            >
              {isCpu ? "CPU" : "GPU"}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Provider</p>
            <p className="text-xs font-[family-name:var(--font-mono)]">
              {compute.face_detection_provider}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Model</p>
            <p className="text-xs font-[family-name:var(--font-mono)]">
              {compute.model}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">RTX 4090</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                gpuAvailable
                  ? isCpu
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-green-500/10 text-green-400"
                  : "bg-muted/30 text-muted-foreground"
              }`}
            >
              {gpuAvailable ? (isCpu ? "Available" : "Active") : "Not detected"}
            </span>
          </div>
        </div>
        {isCpu && gpuAvailable && (
          <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3 flex items-start gap-2">
            <Monitor className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-yellow-400">
                GPU available but not enabled
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                RTX 4090 detected. Switch execution provider to CUDAExecutionProvider
                in insightface.py for ~10x faster face detection.
              </p>
            </div>
          </div>
        )}
        {isCpu && !gpuAvailable && (
          <div className="rounded-lg bg-muted/20 border border-border/30 p-3 flex items-start gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Running on CPU only
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Install onnxruntime-gpu and ensure CUDA drivers are available
                to enable GPU acceleration.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Platform Breakdown Table ---

function PlatformBreakdownTable({ health }: { health: Record<string, any> | null }) {
  const m = health?.metrics || {};
  const pipelineData: any[] = m.platform_pipeline || [];
  const matchData: any[] = m.platform_matches || [];

  if (pipelineData.length === 0) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            Platform Breakdown
          </h3>
          <p className="text-xs text-muted-foreground">
            Waiting for scanner health data...
          </p>
        </CardContent>
      </Card>
    );
  }

  const matchMap = new Map(matchData.map((m: any) => [m.platform, m]));

  return (
    <Card className="bg-card border-border/30">
      <CardContent className="p-4">
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Platform Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Platform</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Total</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Pending</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Faces</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">24h New</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Matches</th>
                <th className="text-right py-2 pl-3 text-muted-foreground font-medium">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {pipelineData.map((p: any) => {
                const matches = matchMap.get(p.platform) || {};
                return (
                  <tr key={p.platform} className="border-b border-border/10">
                    <td className="py-2 pr-3 font-medium capitalize">{p.platform}</td>
                    <td className="text-right py-2 px-3 font-[family-name:var(--font-mono)]">
                      {(p.total ?? 0).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded-full font-[family-name:var(--font-mono)] ${backlogBadge(
                          p.pending_detection ?? 0,
                          100,
                          1000
                        )}`}
                      >
                        {(p.pending_detection ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 font-[family-name:var(--font-mono)]">
                      {(p.with_faces ?? 0).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className="text-green-400 font-[family-name:var(--font-mono)]">
                        {(p.discovered_24h ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 font-[family-name:var(--font-mono)]">
                      {(matches.total_matches ?? 0).toLocaleString()}
                    </td>
                    <td className="text-right py-2 pl-3 font-[family-name:var(--font-mono)]">
                      {(matches.confirmed ?? 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Crawl Status Grid ---

function CrawlStatusGrid({ platforms }: { platforms: PlatformInfo[] }) {
  const enabled = platforms.filter((p) => p.enabled);

  if (enabled.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-3">
        Crawl Status
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {enabled.map((p) => {
          const tagsTotal = p.tags_total || 0;
          const tagsExhausted = p.tags_exhausted || 0;
          const tagProgress = tagsTotal > 0 ? (tagsExhausted / tagsTotal) * 100 : 0;
          const isCrawling = !!p.crawl_phase;

          return (
            <Card key={p.platform} className="bg-card border-border/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium capitalize">{p.platform}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isCrawling
                        ? "bg-green-500/10 text-green-400"
                        : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {p.crawl_phase || "idle"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last crawl</span>
                    <span className="font-[family-name:var(--font-mono)]">
                      {timeAgo(p.last_crawl_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Images</span>
                    <span className="font-[family-name:var(--font-mono)]">
                      {(p.total_images_discovered || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                {tagsTotal > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Tag depth</span>
                      <span className="font-[family-name:var(--font-mono)]">
                        {tagsExhausted}/{tagsTotal}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${tagProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Tab ---

export function PipelineTab({ data, health, platforms }: PipelineTabProps) {
  return (
    <div className="space-y-6">
      <PipelineStageCards data={data} health={health} />
      <BacklogAlerts data={data} health={health} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComputeStatus health={health} />
        <CrawlStatusGrid platforms={platforms} />
      </div>
      <PlatformBreakdownTable health={health} />
    </div>
  );
}
