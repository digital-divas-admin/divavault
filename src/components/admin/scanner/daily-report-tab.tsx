"use client";

import type {
  CommandCenterData,
  TodayScanJob,
  TodayCrawlSnapshot,
  DegradationEvent,
} from "@/lib/scanner-command-queries";
import type { DailySnapshot } from "@/lib/scanner-coverage-utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Image,
  ScanFace,
  Download,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useState, useMemo } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DailyReportTabProps {
  data: CommandCenterData;
  health: Record<string, any> | null;
}

// --- Helpers ---

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

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Today at ${time}` : `${d.toLocaleDateString()} ${time}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "N/A";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/** Compute 7-day average of a metric from daily snapshots for a given platform. */
function compute7DayAvg(
  snapshots: DailySnapshot[],
  platform: string,
  metric: keyof DailySnapshot
): number {
  const platformSnapshots = snapshots
    .filter((s) => s.platform === platform)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  if (platformSnapshots.length < 2) return 0;

  // Compute day-over-day deltas for cumulative metrics
  const deltas: number[] = [];
  for (let i = 1; i < platformSnapshots.length; i++) {
    const delta =
      (platformSnapshots[i][metric] as number) -
      (platformSnapshots[i - 1][metric] as number);
    deltas.push(Math.max(0, delta));
  }

  const recent = deltas.slice(-7);
  return recent.length > 0
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : 0;
}

type StatusLevel = "all-clear" | "attention" | "action-required";

function getComparisonColor(today: number, avg: number): string {
  if (avg === 0) return "text-muted-foreground";
  const ratio = today / avg;
  if (ratio < 0.3 || ratio > 3) return "text-red-400";
  if (ratio < 0.5 || ratio > 1.5) return "text-yellow-400";
  return "text-green-400";
}

function getComparisonLabel(today: number, avg: number): string {
  if (avg === 0) return "no baseline";
  const ratio = today / avg;
  if (ratio < 0.3) return "VERY LOW";
  if (ratio < 0.5) return "LOW";
  if (ratio > 3) return "VERY HIGH";
  if (ratio > 1.5) return "HIGH";
  return "normal";
}

function ComparisonIcon({ today, avg }: { today: number; avg: number }) {
  if (avg === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const ratio = today / avg;
  if (ratio > 1.2) return <TrendingUp className="h-3 w-3" />;
  if (ratio < 0.8) return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

// --- Sub-sections ---

function OverallStatusBanner({
  level,
  issues,
}: {
  level: StatusLevel;
  issues: string[];
}) {
  const config = {
    "all-clear": {
      icon: CheckCircle2,
      bg: "bg-green-500/10 border-green-500/30",
      text: "text-green-400",
      title: "All Clear",
      subtitle: "All platforms crawled, pipeline clear, no issues detected.",
    },
    attention: {
      icon: AlertTriangle,
      bg: "bg-yellow-500/10 border-yellow-500/30",
      text: "text-yellow-400",
      title: "Attention Needed",
      subtitle: "Some metrics are outside normal ranges.",
    },
    "action-required": {
      icon: XCircle,
      bg: "bg-red-500/10 border-red-500/30",
      text: "text-red-400",
      title: "Action Required",
      subtitle: "Critical issues detected that need immediate attention.",
    },
  };

  const c = config[level];
  const Icon = c.icon;

  return (
    <div className={`rounded-lg border p-4 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${c.text}`} />
        <div>
          <h3 className={`text-lg font-semibold ${c.text}`}>{c.title}</h3>
          <p className="text-sm text-muted-foreground">{c.subtitle}</p>
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-1 pl-9">
          {issues.map((issue, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlatformCard({
  platform,
  crawlSnapshots,
  scanJobs,
  avgImages,
  avgFaces,
  lastCrawlAt,
}: {
  platform: string;
  crawlSnapshots: TodayCrawlSnapshot[];
  scanJobs: TodayScanJob[];
  avgImages: number;
  avgFaces: number;
  lastCrawlAt: string | null;
}) {
  const todaySnapshots = crawlSnapshots.filter((s) => s.platform === platform);
  const todayJobs = scanJobs.filter((j) => j.source_name === platform);
  const failedJobs = todayJobs.filter((j) => j.status === "failed");

  // Aggregate today's crawl metrics
  const todayImages = todaySnapshots.reduce(
    (sum, s) => sum + s.images_discovered,
    0
  );
  const todayNew = todaySnapshots.reduce((sum, s) => sum + s.images_new, 0);
  const todayFaces = todaySnapshots.reduce((sum, s) => sum + s.faces_found, 0);
  const todayFailures = todaySnapshots.reduce(
    (sum, s) => sum + s.download_failures,
    0
  );
  const totalDuration = todaySnapshots.reduce(
    (sum, s) => sum + (s.duration_seconds || 0),
    0
  );

  const hasCrawled = todaySnapshots.length > 0;
  const hasError = failedJobs.length > 0 || todaySnapshots.some((s) => s.error_message);
  const latestCrawlTime =
    todaySnapshots[0]?.created_at ?? lastCrawlAt;

  // Determine status
  let statusBadge: { label: string; color: string };
  if (hasError) {
    statusBadge = { label: "Error", color: "bg-red-500/20 text-red-400" };
  } else if (hasCrawled) {
    statusBadge = {
      label: "Crawled",
      color: "bg-green-500/20 text-green-400",
    };
  } else {
    statusBadge = {
      label: "Not Yet",
      color: "bg-yellow-500/20 text-yellow-400",
    };
  }

  return (
    <Card className="bg-card border-border/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold capitalize">{platform}</h4>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {latestCrawlTime && (
              <span>
                {formatTime(latestCrawlTime)} ({timeAgo(latestCrawlTime)})
              </span>
            )}
          </div>
        </div>

        {hasCrawled ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <MetricCell
                icon={Image}
                label="Discovered"
                value={todayImages}
                avg={avgImages}
              />
              <MetricCell
                icon={Download}
                label="New"
                value={todayNew}
              />
              <MetricCell
                icon={ScanFace}
                label="Faces"
                value={todayFaces}
                avg={avgFaces}
              />
              <MetricCell
                icon={AlertTriangle}
                label="Failures"
                value={todayFailures}
                isFailure
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                <Clock className="h-3 w-3 inline mr-1" />
                {formatDuration(totalDuration)}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No crawl recorded today.{" "}
            {lastCrawlAt && <>Last crawl: {timeAgo(lastCrawlAt)}.</>}
          </p>
        )}

        {failedJobs.length > 0 && (
          <div className="mt-3 space-y-1">
            {failedJobs.map((job) => (
              <div
                key={job.id}
                className="text-xs text-red-400 bg-red-500/10 rounded p-2"
              >
                Scan failed: {job.error_message || "Unknown error"}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({
  icon: Icon,
  label,
  value,
  avg,
  isFailure,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  avg?: number;
  isFailure?: boolean;
}) {
  const hasAvg = avg !== undefined && avg > 0;
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Icon
          className={`h-3 w-3 ${isFailure && value > 0 ? "text-red-400" : "text-muted-foreground"}`}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p
        className={`text-sm font-semibold font-[family-name:var(--font-mono)] ${isFailure && value > 0 ? "text-red-400" : ""}`}
      >
        {value.toLocaleString()}
      </p>
      {hasAvg && (
        <div
          className={`flex items-center gap-1 text-xs ${getComparisonColor(value, avg)}`}
        >
          <ComparisonIcon today={value} avg={avg} />
          <span>
            avg {Math.round(avg).toLocaleString()} &mdash;{" "}
            {getComparisonLabel(value, avg)}
          </span>
        </div>
      )}
    </div>
  );
}

function PipelineThroughput({
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
      throughput: m.images_discovered_24h ?? 0,
      backlog: null as number | null,
    },
    {
      label: "Detected",
      throughput: m.faces_detected_24h ?? 0,
      backlog:
        m.images_pending_detection ?? data.pipeline.pendingDetectionCount,
    },
    {
      label: "Matched",
      throughput: m.faces_matched_24h ?? m.matches_found_24h ?? 0,
      backlog:
        m.faces_pending_matching ?? data.pipeline.pendingMatchingCount,
    },
    {
      label: "Reviewed",
      throughput: m.matches_found_24h ?? 0,
      backlog:
        m.matches_pending_review ??
        data.pipeline.matchesPendingReviewCount,
    },
  ];

  function backlogColor(count: number | null): string {
    if (count === null || count === 0) return "text-green-400";
    if (count < 1000) return "text-yellow-400";
    return "text-red-400";
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">Pipeline Throughput (24h)</h3>
      <div className="flex items-center gap-1">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1 flex-1 min-w-0">
            <Card className="flex-1 bg-card border-border/30">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-sm font-semibold font-[family-name:var(--font-mono)]">
                  {(s.throughput ?? 0).toLocaleString()}
                </p>
                {s.backlog !== null && (
                  <p
                    className={`text-xs mt-1 ${backlogColor(s.backlog)}`}
                  >
                    {s.backlog === 0
                      ? "0 pending"
                      : `${s.backlog.toLocaleString()} pending`}
                  </p>
                )}
              </CardContent>
            </Card>
            {i < stages.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchSummary({ data }: { data: CommandCenterData }) {
  const todayStart = new Date().toISOString().split("T")[0];
  const todayMatches = data.recentMatches.filter(
    (m) => m.created_at && m.created_at >= todayStart
  );

  const byTier = { high: 0, medium: 0, low: 0 };
  let knownAccounts = 0;
  for (const m of todayMatches) {
    const tier = (m.confidence_tier || "low") as keyof typeof byTier;
    if (tier in byTier) byTier[tier]++;
    if (m.is_known_account) knownAccounts++;
  }

  if (todayMatches.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-3">Match Summary</h3>
        <p className="text-sm text-muted-foreground">No matches found today.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">
        Match Summary ({todayMatches.length} today)
      </h3>
      <div className="flex gap-3">
        {byTier.high > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
            {byTier.high} high confidence
          </span>
        )}
        {byTier.medium > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
            {byTier.medium} medium
          </span>
        )}
        {byTier.low > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
            {byTier.low} low
          </span>
        )}
        {knownAccounts > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">
            {knownAccounts} known accounts
          </span>
        )}
      </div>
    </div>
  );
}

function BackfillProgress({ data }: { data: CommandCenterData }) {
  const platformsWithBackfill = data.platforms.filter((p) => p.backfill);
  if (platformsWithBackfill.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">Backfill Progress</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {platformsWithBackfill.map((p) => {
          const bf = p.backfill!;
          return (
            <Card key={p.platform} className="bg-card border-border/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium capitalize">
                    {p.platform}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      bf.complete
                        ? "bg-green-500/20 text-green-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {bf.complete
                      ? "Complete"
                      : `${Math.round(bf.pctComplete)}%`}
                  </span>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${bf.complete ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(100, bf.pctComplete)}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {p.platform === "civitai" && bf.cursorDate
                    ? `Cursor: ${new Date(bf.cursorDate).toLocaleDateString()}`
                    : `${bf.termsExhausted}/${bf.termsTotal} terms exhausted`}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ErrorsAndWarnings({
  scanJobs,
  degradationEvents,
  crawlSnapshots,
}: {
  scanJobs: TodayScanJob[];
  degradationEvents: DegradationEvent[];
  crawlSnapshots: TodayCrawlSnapshot[];
}) {
  const [expanded, setExpanded] = useState(false);
  const failedJobs = scanJobs.filter((j) => j.status === "failed");
  const snapshotErrors = crawlSnapshots.filter((s) => s.error_message);
  const httpErrors = crawlSnapshots.filter(
    (s) => s.http_errors && Object.keys(s.http_errors).length > 0
  );

  const totalIssues =
    failedJobs.length + degradationEvents.length + snapshotErrors.length + httpErrors.length;

  if (totalIssues === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-3">Errors & Warnings</h3>
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>No errors or warnings</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium mb-3 hover:text-foreground transition-colors"
      >
        Errors & Warnings ({totalIssues})
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2">
          {failedJobs.map((job) => (
            <div
              key={job.id}
              className="text-xs bg-red-500/10 text-red-400 rounded p-2"
            >
              <span className="font-medium">
                Failed scan ({job.source_name}):
              </span>{" "}
              {job.error_message || "Unknown error"}
            </div>
          ))}
          {degradationEvents.map((event) => (
            <div
              key={event.id}
              className={`text-xs rounded p-2 ${
                event.severity === "critical"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-yellow-500/10 text-yellow-400"
              }`}
            >
              <span className="font-medium capitalize">
                [{event.severity}] {event.platform}:
              </span>{" "}
              {event.symptom}
            </div>
          ))}
          {snapshotErrors.map((s, i) => (
            <div
              key={`snap-err-${i}`}
              className="text-xs bg-yellow-500/10 text-yellow-400 rounded p-2"
            >
              <span className="font-medium capitalize">
                {s.platform} crawl error:
              </span>{" "}
              {s.error_message}
            </div>
          ))}
          {httpErrors.map((s, i) => (
            <div
              key={`http-err-${i}`}
              className="text-xs bg-yellow-500/10 text-yellow-400 rounded p-2"
            >
              <span className="font-medium capitalize">
                {s.platform} HTTP errors:
              </span>{" "}
              {JSON.stringify(s.http_errors)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BaselineComparisonTable({
  data,
  platformAvgs,
}: {
  data: CommandCenterData;
  platformAvgs: Record<string, { images: number; faces: number }>;
}) {
  const enabledPlatforms = data.platforms.filter((p) => p.enabled);
  const todayStart = new Date().toISOString().split("T")[0];

  const rows: {
    metric: string;
    today: number;
    avg: number;
    status: string;
    color: string;
  }[] = [];

  for (const p of enabledPlatforms) {
    const platformSnapshots = data.todayCrawlSnapshots.filter(
      (s) => s.platform === p.platform
    );
    const todayImages = platformSnapshots.reduce(
      (sum, s) => sum + s.images_discovered,
      0
    );
    const todayFaces = platformSnapshots.reduce(
      (sum, s) => sum + s.faces_found,
      0
    );
    const avgImages = platformAvgs[p.platform]?.images ?? 0;
    const avgFaces = platformAvgs[p.platform]?.faces ?? 0;

    rows.push({
      metric: `${p.platform} Images`,
      today: todayImages,
      avg: Math.round(avgImages),
      status: getComparisonLabel(todayImages, avgImages),
      color: getComparisonColor(todayImages, avgImages),
    });
    rows.push({
      metric: `${p.platform} Faces`,
      today: todayFaces,
      avg: Math.round(avgFaces),
      status: getComparisonLabel(todayFaces, avgFaces),
      color: getComparisonColor(todayFaces, avgFaces),
    });
  }

  // Add match count
  const todayMatches = data.recentMatches.filter(
    (m) => m.created_at && m.created_at >= todayStart
  ).length;
  rows.push({
    metric: "Matches",
    today: todayMatches,
    avg: 0,
    status: "N/A",
    color: "text-muted-foreground",
  });

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">Baseline Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left py-2 text-xs font-medium text-muted-foreground">
                Metric
              </th>
              <th className="text-right py-2 text-xs font-medium text-muted-foreground">
                Today
              </th>
              <th className="text-right py-2 text-xs font-medium text-muted-foreground">
                7d Avg
              </th>
              <th className="text-right py-2 text-xs font-medium text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-b border-border/10">
                <td className="py-1.5 capitalize">{row.metric}</td>
                <td className="py-1.5 text-right font-[family-name:var(--font-mono)]">
                  {row.today.toLocaleString()}
                </td>
                <td className="py-1.5 text-right font-[family-name:var(--font-mono)] text-muted-foreground">
                  {row.avg > 0 ? row.avg.toLocaleString() : "--"}
                </td>
                <td className={`py-1.5 text-right text-xs ${row.color}`}>
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Main Component ---

export function DailyReportTab({ data, health }: DailyReportTabProps) {
  const enabledPlatforms = useMemo(
    () => data.platforms.filter((p) => p.enabled),
    [data.platforms]
  );

  // Pre-compute 7-day averages per platform (avoids repeated filter+sort+delta in children)
  const platformAvgs = useMemo(() => {
    const avgs: Record<string, { images: number; faces: number }> = {};
    for (const p of enabledPlatforms) {
      avgs[p.platform] = {
        images: compute7DayAvg(data.dailySnapshots, p.platform, "images_discovered"),
        faces: compute7DayAvg(data.dailySnapshots, p.platform, "images_with_faces"),
      };
    }
    return avgs;
  }, [data.dailySnapshots, enabledPlatforms]);

  // Compute overall status
  const { level, issues } = useMemo(() => {
    const issues: string[] = [];
    let level: StatusLevel = "all-clear";

    // Check: platforms crawled in last 26 hours
    for (const p of enabledPlatforms) {
      if (!p.last_crawl_at) {
        issues.push(`${p.platform} has never been crawled`);
        level = "action-required";
        continue;
      }
      const hoursSince =
        (Date.now() - new Date(p.last_crawl_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 26) {
        issues.push(
          `${p.platform} last crawled ${Math.round(hoursSince)}h ago (>26h)`
        );
        if (level !== "action-required") level = "action-required";
      }
    }

    // Check: failed scan jobs today
    const failedJobs = data.todayScanJobs.filter((j) => j.status === "failed");
    if (failedJobs.length > 0) {
      issues.push(`${failedJobs.length} failed scan job(s) today`);
      if (level !== "action-required") level = "action-required";
    }

    // Check: open degradation events
    const criticalEvents = data.openDegradationEvents.filter(
      (e) => e.severity === "critical"
    );
    const warningEvents = data.openDegradationEvents.filter(
      (e) => e.severity === "warning"
    );
    if (criticalEvents.length > 0) {
      issues.push(
        `${criticalEvents.length} critical degradation event(s)`
      );
      level = "action-required";
    }
    if (warningEvents.length > 0) {
      issues.push(`${warningEvents.length} warning degradation event(s)`);
      if (level === "all-clear") level = "attention";
    }

    // Check: pipeline backlogs
    const m = health?.metrics || {};
    const pendingDetection =
      m.images_pending_detection ?? data.pipeline.pendingDetectionCount;
    const pendingMatching =
      m.faces_pending_matching ?? data.pipeline.pendingMatchingCount;
    if (pendingDetection > 10000 || pendingMatching > 5000) {
      issues.push(
        `Pipeline backlog: ${pendingDetection.toLocaleString()} pending detection, ${pendingMatching.toLocaleString()} pending matching`
      );
      if (level === "all-clear") level = "attention";
    }

    // Check: low image counts vs baseline
    for (const p of enabledPlatforms) {
      const todaySnapshots = data.todayCrawlSnapshots.filter(
        (s) => s.platform === p.platform
      );
      if (todaySnapshots.length === 0) continue;
      const todayImages = todaySnapshots.reduce(
        (sum, s) => sum + s.images_discovered,
        0
      );
      const avgImages = platformAvgs[p.platform]?.images ?? 0;
      if (avgImages > 0 && todayImages / avgImages < 0.3) {
        issues.push(
          `${p.platform} images very low: ${todayImages} vs avg ${Math.round(avgImages)}`
        );
        if (level === "all-clear") level = "attention";
      }
    }

    return { level, issues };
  }, [data, health, enabledPlatforms, platformAvgs]);

  return (
    <div className="space-y-6">
      {/* A. Overall Status Banner */}
      <OverallStatusBanner level={level} issues={issues} />

      {/* B. Platform Checklist */}
      <div>
        <h3 className="text-sm font-medium mb-3">Platform Checklist</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {enabledPlatforms.map((p) => (
            <PlatformCard
              key={p.platform}
              platform={p.platform}
              crawlSnapshots={data.todayCrawlSnapshots}
              scanJobs={data.todayScanJobs}
              avgImages={platformAvgs[p.platform]?.images ?? 0}
              avgFaces={platformAvgs[p.platform]?.faces ?? 0}
              lastCrawlAt={p.last_crawl_at}
            />
          ))}
        </div>
      </div>

      {/* C. Pipeline Throughput */}
      <PipelineThroughput data={data} health={health} />

      {/* D. Match Summary */}
      <MatchSummary data={data} />

      {/* E. Backfill Progress */}
      <BackfillProgress data={data} />

      {/* F. Errors & Warnings */}
      <ErrorsAndWarnings
        scanJobs={data.todayScanJobs}
        degradationEvents={data.openDegradationEvents}
        crawlSnapshots={data.todayCrawlSnapshots}
      />

      {/* G. Baseline Comparison Table */}
      <BaselineComparisonTable data={data} platformAvgs={platformAvgs} />
    </div>
  );
}
