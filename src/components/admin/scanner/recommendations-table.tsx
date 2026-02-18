"use client";

import { useState } from "react";
import type { Recommendation } from "@/lib/scanner-command-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

interface RecommendationsTableProps {
  recommendations: Recommendation[];
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const pct = (confidence * 100).toFixed(0);
  const color =
    confidence >= 0.8
      ? "bg-green-500/10 text-green-400"
      : confidence >= 0.5
        ? "bg-yellow-500/10 text-yellow-400"
        : "bg-red-500/10 text-red-400";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-[family-name:var(--font-mono)] ${color}`}>
      {pct}%
    </span>
  );
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const color =
    level === "high"
      ? "bg-red-500/10 text-red-400"
      : level === "medium"
        ? "bg-yellow-500/10 text-yellow-400"
        : "bg-green-500/10 text-green-400";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${color}`}>
      {level}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400",
    approved: "bg-green-500/10 text-green-400",
    dismissed: "bg-red-500/10 text-red-400",
    applied: "bg-primary/10 text-primary",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${colors[status] || "bg-muted/20 text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

export function RecommendationsTable({
  recommendations,
}: RecommendationsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAction(id: string, action: "approve" | "dismiss") {
    setOptimistic((prev) => ({ ...prev, [id]: action === "approve" ? "approved" : "dismissed" }));
    try {
      const res = await fetch(
        `/api/admin/scanner/ml/recommendations/${id}/${action}`,
        { method: "POST" }
      );
      if (!res.ok) {
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No recommendations to review
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec) => {
        const isExpanded = expanded.has(rec.id);
        const currentStatus = optimistic[rec.id] || rec.status;
        const isPending = currentStatus === "pending";

        return (
          <Card key={rec.id} className="bg-card border-border/30">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleExpand(rec.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {rec.recommendation_type.replace(/_/g, " ")}
                    </span>
                    {rec.target_platform && (
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {rec.target_platform}
                      </span>
                    )}
                    <StatusBadge status={currentStatus} />
                    <ConfidenceBadge confidence={rec.confidence} />
                    <RiskBadge level={rec.risk_level} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {rec.reasoning || "No reasoning provided"}
                  </p>
                </div>
                {isPending && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAction(rec.id, "approve")}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(rec.id, "dismiss")}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="mt-3 ml-11 space-y-2 text-xs text-muted-foreground">
                  {rec.reasoning && (
                    <div>
                      <span className="text-foreground font-medium">
                        Reasoning:
                      </span>{" "}
                      {rec.reasoning}
                    </div>
                  )}
                  {rec.expected_impact && (
                    <div>
                      <span className="text-foreground font-medium">
                        Expected Impact:
                      </span>{" "}
                      {rec.expected_impact}
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <span>
                      Target: {rec.target_entity} / {rec.target_id}
                    </span>
                    <span>
                      Created:{" "}
                      {new Date(rec.created_at).toLocaleDateString()}
                    </span>
                    {rec.reviewed_at && (
                      <span>
                        Reviewed:{" "}
                        {new Date(rec.reviewed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
