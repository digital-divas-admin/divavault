"use client";

import { useState } from "react";
import type { CommandCenterData } from "@/lib/scanner-command-queries";
import { Card, CardContent } from "@/components/ui/card";
import {
  Image,
  ScanFace,
  Fingerprint,
  Target,
  Globe,
  Brain,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Types ---

type TabId = "command" | "crawl-map" | "ml-intelligence" | "test-users";

interface CommandTabProps {
  data: CommandCenterData;
  activity: any[] | null;
  onSwitchTab: (tabId: TabId, context?: { platform?: string }) => void;
}

// --- Signal display map ---

const SIGNAL_ICONS: Record<string, { icon: typeof Activity; label: string }> = {
  match_confirmed: { icon: CheckCircle2, label: "Match confirmed" },
  match_rejected: { icon: XCircle, label: "Match rejected" },
  match_found: { icon: Target, label: "New match" },
  section_toggle: { icon: Zap, label: "Section toggled" },
  recommendation_approved: { icon: CheckCircle2, label: "Rec approved" },
  recommendation_dismissed: { icon: XCircle, label: "Rec dismissed" },
  threshold_adjusted: { icon: BarChart3, label: "Threshold adjusted" },
  model_retrained: { icon: Brain, label: "Model retrained" },
  crawl_completed: { icon: Globe, label: "Crawl completed" },
  matching_completed: { icon: Fingerprint, label: "Matching finished" },
  ml_cycle_completed: { icon: Brain, label: "ML cycle completed" },
};

function getSignalDisplay(signalType: string) {
  return SIGNAL_ICONS[signalType] || { icon: Activity, label: signalType.replace(/_/g, " ") };
}

/** Build a human-readable description from signal type + context JSONB. */
function getSignalDescription(item: any): string | null {
  const ctx = item.context || {};
  const entityId = item.entity_id || "";

  switch (item.signal_type) {
    case "crawl_completed": {
      const platform = entityId || ctx.platform || "";
      const count = ctx.total_discovered ?? ctx.images_discovered;
      const parts = [platform && platform.charAt(0).toUpperCase() + platform.slice(1), "crawl completed"];
      if (count != null) parts.push(`\u2014 ${Number(count).toLocaleString()} images`);
      return parts.filter(Boolean).join(" ");
    }
    case "matching_completed": {
      const found = ctx.matches_found ?? ctx.new_matches;
      if (found != null) return `Matching finished \u2014 ${found} new match${found === 1 ? "" : "es"}`;
      return "Matching finished";
    }
    case "match_found": {
      const platform = ctx.platform || entityId || "";
      const confidence = ctx.confidence ?? ctx.similarity;
      const parts = ["New match"];
      if (platform) parts.push(`on ${platform}`);
      if (confidence != null) parts.push(`(${Math.round(confidence * 100)}% confidence)`);
      return parts.join(" ");
    }
    case "ml_cycle_completed": {
      const analyzers = ctx.analyzers_run;
      const recs = ctx.recommendations_generated;
      const parts = ["ML cycle completed"];
      if (analyzers != null) parts.push(`\u2014 ${analyzers} analyzers`);
      if (recs != null && recs > 0) parts.push(`, ${recs} rec${recs === 1 ? "" : "s"}`);
      return parts.join("");
    }
    default:
      return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// --- Stats Row ---

function StatsRow({ data }: { data: CommandCenterData }) {
  const stats = [
    {
      icon: Image,
      value: data.funnel.discovered,
      label: "Discovered",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: ScanFace,
      value: data.funnel.withFaces,
      label: "Faces Found",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      icon: Fingerprint,
      value: data.funnel.compared,
      label: "Registry",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      icon: Target,
      value: data.funnel.matched,
      label: "Matches",
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      icon: Globe,
      value: data.platforms.filter((p) => p.enabled).length,
      label: "Platforms",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Brain,
      value: data.signalStats.reduce((s, x) => s + x.count, 0),
      label: "ML Signals",
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="bg-card border-border/30">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className={`rounded-full p-1.5 ${s.bg}`}>
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                {s.value.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Pipeline Funnel ---

function PipelineFunnel({ funnel }: { funnel: CommandCenterData["funnel"] }) {
  const max = Math.max(funnel.discovered, 1);
  const stages = [
    { label: "Discovered", value: funnel.discovered, color: "bg-slate-500" },
    { label: "Faces Found", value: funnel.withFaces, color: "bg-blue-500" },
    { label: "Compared", value: funnel.compared, color: "bg-indigo-500" },
    { label: "Matched", value: funnel.matched, color: "bg-purple-500" },
    { label: "Confirmed", value: funnel.confirmed, color: "bg-green-500" },
  ];

  return (
    <Card className="bg-card border-border/30">
      <CardContent className="p-4 space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Pipeline Funnel
        </h3>
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 shrink-0">
              {s.label}
            </span>
            <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full ${s.color} rounded-full transition-all duration-500`}
                style={{
                  width: `${Math.max((s.value / max) * 100, s.value > 0 ? 2 : 0)}%`,
                }}
              />
            </div>
            <span className="text-xs font-[family-name:var(--font-mono)] text-foreground w-16 text-right">
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Platform Cards ---

function PlatformCards({
  data,
  onSwitchTab,
}: {
  data: CommandCenterData;
  onSwitchTab: CommandTabProps["onSwitchTab"];
}) {
  const enabledPlatforms = data.platforms.filter((p) => p.enabled);

  if (enabledPlatforms.length === 0) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No platforms enabled
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-3">
        Active Platforms
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {enabledPlatforms.map((platform) => {
          const sparkData = (data.platformSparklines[platform.platform] || []).map(
            (v, i) => ({ i, v })
          );
          const sectionCount = data.sections.filter(
            (s) => s.platform === platform.platform
          ).length;

          return (
            <Card
              key={platform.platform}
              className="bg-card border-border/30 hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() =>
                onSwitchTab("crawl-map", { platform: platform.platform })
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm capitalize">
                    {platform.platform}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      platform.crawl_phase === "active"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {platform.crawl_phase || "idle"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p className="text-xs font-[family-name:var(--font-mono)] text-foreground">
                      {(platform.total_images_discovered || 0).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Images</p>
                  </div>
                  <div>
                    <p className="text-xs font-[family-name:var(--font-mono)] text-foreground">
                      {sectionCount}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Sections</p>
                  </div>
                  <div>
                    <p className="text-xs font-[family-name:var(--font-mono)] text-foreground">
                      {platform.tags_total || 0}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Tags</p>
                  </div>
                </div>
                {sparkData.length > 0 && (
                  <div className="h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData}>
                        <defs>
                          <linearGradient
                            id={`spark-${platform.platform}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke="#8B5CF6"
                          strokeWidth={1.5}
                          fill={`url(#spark-${platform.platform})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
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

// --- Pending Recommendations ---

function PendingRecommendations({
  recommendations,
}: {
  recommendations: CommandCenterData["recommendations"];
}) {
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const pending = recommendations.filter(
    (r) => r.status === "pending" && !optimistic[r.id]
  );

  if (pending.length === 0) return null;

  async function handleAction(id: string, action: "approve" | "dismiss") {
    setOptimistic((prev) => ({ ...prev, [id]: action }));
    try {
      await fetch(`/api/admin/scanner/ml/recommendations/${id}/${action}`, {
        method: "POST",
      });
    } catch {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-3">
        ML Recommendations ({pending.length} pending)
      </h3>
      <div className="space-y-2">
        {pending.slice(0, 5).map((rec) => (
          <Card key={rec.id} className="bg-card border-border/30">
            <CardContent className="p-3 flex items-start gap-3">
              <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {rec.recommendation_type.replace(/_/g, " ")}
                  {rec.target_platform && (
                    <span className="text-muted-foreground ml-1.5 text-xs capitalize">
                      {rec.target_platform}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {rec.reasoning || "No reasoning provided"}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {rec.confidence !== null && (
                    <span className="text-[10px] font-[family-name:var(--font-mono)] text-muted-foreground">
                      {(rec.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                  {rec.risk_level && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        rec.risk_level === "high"
                          ? "bg-red-500/10 text-red-400"
                          : rec.risk_level === "medium"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-green-500/10 text-green-400"
                      }`}
                    >
                      {rec.risk_level}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleAction(rec.id, "approve")}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(rec.id, "dismiss")}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Test User Summary ---

function TestUserSummary({
  summary,
  onSwitchTab,
}: {
  summary: CommandCenterData["testUserSummary"];
  onSwitchTab: CommandTabProps["onSwitchTab"];
}) {
  const total = summary.seeded + summary.honeypot + summary.synthetic;
  if (total === 0) return null;

  return (
    <Card className="bg-card border-border/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Test Users
          </h3>
          <button
            onClick={() => onSwitchTab("test-users")}
            className="text-[10px] text-primary hover:underline"
          >
            View details
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
              {summary.seeded}
            </p>
            <p className="text-[10px] text-muted-foreground">Seeded</p>
          </div>
          <div>
            <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
              {summary.honeypot}
            </p>
            <p className="text-[10px] text-muted-foreground">Honeypot</p>
          </div>
          <div>
            <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
              {summary.synthetic}
            </p>
            <p className="text-[10px] text-muted-foreground">Synthetic</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Activity Feed ---

function ActivityFeed({ activity }: { activity: any[] | null }) {
  if (!activity || activity.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-8">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activity.map((item: any) => {
        const display = getSignalDisplay(item.signal_type);
        const Icon = display.icon;
        const description = getSignalDescription(item);
        return (
          <div
            key={item.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/20 transition-colors"
          >
            <Icon className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-foreground truncate">
                {description || display.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {timeAgo(item.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Tab ---

export function CommandTab({ data, activity, onSwitchTab }: CommandTabProps) {
  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-6 min-w-0">
        <StatsRow data={data} />
        <PipelineFunnel funnel={data.funnel} />
        <PlatformCards data={data} onSwitchTab={onSwitchTab} />
        <PendingRecommendations recommendations={data.recommendations} />
        <TestUserSummary summary={data.testUserSummary} onSwitchTab={onSwitchTab} />
      </div>

      {/* Activity sidebar */}
      <div className="hidden lg:block w-[260px] shrink-0">
        <div className="sticky top-4">
          <Card className="bg-card border-border/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-3">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-medium text-muted-foreground">
                  Activity Feed
                </h3>
              </div>
              <ActivityFeed activity={activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
