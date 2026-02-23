"use client";

import type {
  Recommendation,
  ModelStateEntry,
} from "@/lib/scanner-command-queries";
import { Card, CardContent } from "@/components/ui/card";
import { RecommendationsTable } from "./recommendations-table";
import {
  Brain,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Zap,
  Target,
  BarChart3,
  XCircle,
  RefreshCw,
  Gauge,
  Search,
  ShieldAlert,
  ScanFace,
  Fingerprint,
  Layers,
  ScanLine,
  Globe,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MLIntelligenceTabProps {
  recommendations: Recommendation[];
  pendingRecsCount: number;
  appliedRecs: Recommendation[];
  modelState: ModelStateEntry[];
  signalStats: { signal_type: string; count: number }[];
  health: any;
}

// Signal type → display config
const FEEDBACK_LOOP_CARDS = [
  {
    signal: "match_found",
    icon: CheckCircle2,
    label: "Match Found",
    effect: "New potential match detected by scanner",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    signal: "match_rejected",
    icon: XCircle,
    label: "Match Rejected",
    effect: "Raises threshold to reduce false positives",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    signal: "section_toggle",
    icon: Zap,
    label: "Section Toggle",
    effect: "Updates section priority model",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    signal: "recommendation_approved",
    icon: CheckCircle2,
    label: "Rec Approved",
    effect: "Validates recommendation model accuracy",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    signal: "recommendation_dismissed",
    icon: XCircle,
    label: "Rec Dismissed",
    effect: "Adjusts recommendation criteria",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    signal: "threshold_adjusted",
    icon: Gauge,
    label: "Threshold Adjusted",
    effect: "Recalibrates detection sensitivity",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    signal: "model_retrained",
    icon: RefreshCw,
    label: "Model Retrained",
    effect: "Updates all downstream predictions",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    signal: "crawl_completed",
    icon: Target,
    label: "Crawl Completed",
    effect: "Feeds new data into section profiling",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    signal: "fp_score",
    icon: ShieldAlert,
    label: "FP Scored",
    effect: "Ranks review queue by false positive likelihood",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    signal: "analyzer_completed",
    icon: Search,
    label: "Analyzer Run",
    effect: "New recommendations generated from data",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    signal: "faces_detected",
    icon: ScanFace,
    label: "Faces Detected",
    effect: "Face detection batch processed",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    signal: "matching_completed",
    icon: Fingerprint,
    label: "Matching Run",
    effect: "Face embedding comparison batch completed",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    signal: "ml_cycle_completed",
    icon: Brain,
    label: "ML Cycle",
    effect: "Full ML orchestration cycle completed",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    signal: "scan_completed",
    icon: ScanLine,
    label: "Scan Completed",
    effect: "Scan job finished processing",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    signal: "taxonomy_mapped",
    icon: Layers,
    label: "Taxonomy Mapped",
    effect: "Platform content taxonomy updated",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

export function MLIntelligenceTab({
  recommendations,
  pendingRecsCount,
  appliedRecs,
  modelState,
  signalStats,
  health,
}: MLIntelligenceTabProps) {
  const signalMap = new Map(signalStats.map((s) => [s.signal_type, s.count]));
  const totalSignals = signalStats.reduce((s, x) => s + x.count, 0);
  const latestModel = modelState[0];
  const analyzers = health?.ml?.analyzers || [];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border/30">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="rounded-full p-1.5 bg-primary/10">
              <Brain className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                {latestModel ? `v${latestModel.version}` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {latestModel?.model_name || "Model Version"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="rounded-full p-1.5 bg-blue-500/10">
              <Activity className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                {totalSignals.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">Total Signals</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="rounded-full p-1.5 bg-green-500/10">
              <Clock className="h-3.5 w-3.5 text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium">
                {latestModel?.trained_at
                  ? new Date(latestModel.trained_at).toLocaleDateString()
                  : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Last Training</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="rounded-full p-1.5 bg-yellow-500/10">
              <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
            </div>
            <div>
              <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                {pendingRecsCount.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Pending Reviews
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback loops grid */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Feedback Loops
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FEEDBACK_LOOP_CARDS.map((card) => {
            const Icon = card.icon;
            const count = signalMap.get(card.signal) || 0;
            return (
              <Card key={card.signal} className="bg-card border-border/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`rounded-full p-1 ${card.bg}`}>
                      <Icon className={`h-3 w-3 ${card.color}`} />
                    </div>
                    <span className="text-xs font-medium">{card.label}</span>
                  </div>
                  <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                    {count.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {card.effect}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Analyzer status */}
      {analyzers.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            Analyzer Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {analyzers.map((analyzer: any) => {
              const progress =
                analyzer.minimum_signals && analyzer.signal_count
                  ? Math.min(
                      (analyzer.signal_count / analyzer.minimum_signals) * 100,
                      100
                    )
                  : 0;
              const isActive = analyzer.status === "ACTIVE";

              return (
                <Card
                  key={analyzer.name}
                  className="bg-card border-border/30"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {analyzer.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          isActive
                            ? "bg-green-500/10 text-green-400"
                            : "bg-yellow-500/10 text-yellow-400"
                        }`}
                      >
                        {analyzer.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isActive ? "bg-green-500" : "bg-yellow-500"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-[family-name:var(--font-mono)] text-muted-foreground">
                        {analyzer.signal_count || 0}/
                        {analyzer.minimum_signals || "?"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations table */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Recommendations
        </h3>
        <RecommendationsTable recommendations={recommendations} />
      </div>

      {/* Applied improvements */}
      {appliedRecs.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Recently Applied
          </h3>
          <div className="space-y-2">
            {appliedRecs.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border/30"
              >
                <BarChart3 className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {rec.recommendation_type.replace(/_/g, " ")}
                    {rec.target_platform && (
                      <span className="text-muted-foreground ml-1.5 text-xs capitalize">
                        {rec.target_platform}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {rec.reasoning || rec.expected_impact || "Applied"}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {rec.applied_at
                    ? new Date(rec.applied_at).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
