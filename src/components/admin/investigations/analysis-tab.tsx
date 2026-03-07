"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { getAiScoreBarColor, getAiScoreTextColor, getAiScoreBadgeColor, getAiVerdictLabel } from "@/lib/investigation-utils";
import type { InvestigationDetail, InvestigationEvidence, TaskType } from "@/types/investigations";

interface AnalysisTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

function DetectorCard({
  name,
  subtitle,
  frames,
  getScore,
  getExtra,
}: {
  name: string;
  subtitle: string;
  frames: InvestigationEvidence[];
  getScore: (ev: InvestigationEvidence) => number | null;
  getExtra?: (ev: InvestigationEvidence) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const scores = frames.map(getScore).filter((s): s is number => s !== null);
  if (scores.length === 0) return null;

  const peak = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bot className="h-4 w-4 text-cyan-500" />
          <div className="text-left">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground ml-2">{subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`text-xs ${getAiScoreBadgeColor(peak)}`}>
            Peak: {(peak * 100).toFixed(1)}%
          </Badge>
          <span className="text-xs text-muted-foreground">
            {scores.length} frame{scores.length !== 1 ? "s" : ""}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50">
          {/* Summary bar */}
          <div className="px-5 py-3 bg-muted/20 flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Peak:</span>
              <span className={`font-bold ${getAiScoreTextColor(peak)}`}>
                {(peak * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Avg:</span>
              <span className={`font-bold ${getAiScoreTextColor(avg)}`}>
                {(avg * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Verdict:</span>
              <span className={`font-semibold ${getAiScoreTextColor(peak)}`}>
                {getAiVerdictLabel(peak)}
              </span>
            </div>
          </div>

          {/* Per-frame table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground">
                <th className="text-left px-5 py-2 font-medium">Frame</th>
                <th className="text-left px-3 py-2 font-medium w-[40%]">Score</th>
                <th className="text-left px-3 py-2 font-medium">Verdict</th>
                <th className="text-right px-5 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {frames.map((ev) => {
                const score = getScore(ev);
                if (score === null) return null;
                return (
                  <tr key={ev.id} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="px-5 py-2.5 font-medium text-foreground">
                      #{ev.frame_number}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getAiScoreBarColor(score)}`}
                            style={{ width: `${Math.min(score * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`font-bold w-14 text-right ${getAiScoreTextColor(score)}`}>
                          {(score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-semibold ${getAiScoreTextColor(score)}`}>
                        {getAiVerdictLabel(score)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {getExtra?.(ev)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AnalysisTab({ data, onUpdate }: AnalysisTabProps) {
  const aiEvidence = data.evidence.filter((e) => e.evidence_type === "ai_detection");
  const provEvidence = data.evidence.filter((e) => e.evidence_type === "provenance_check");

  const hasHive = aiEvidence.some((e) => e.ai_detection_score !== null);
  const hasSentinel = aiEvidence.some((e) => e.sentinel_score !== null);

  return (
    <div className="space-y-6">
      {/* Analysis Trigger Buttons */}
      <div className="flex gap-2 flex-wrap">
        <AnalysisTriggerButton
          investigationId={data.id}
          taskType="check_provenance"
          label="Run Provenance Check"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
        <AnalysisTriggerButton
          investigationId={data.id}
          taskType="ai_detection"
          label="Run AI Detection"
          icon={<Bot className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
      </div>

      {/* Hive AI Detector */}
      {hasHive && (
        <DetectorCard
          name="Hive AI"
          subtitle="thehive.ai"
          frames={aiEvidence}
          getScore={(ev) => ev.ai_detection_score}
          getExtra={(ev) =>
            ev.ai_detection_generator ? (
              <Badge variant="outline" className="text-[10px]">
                {ev.ai_detection_generator}
              </Badge>
            ) : null
          }
        />
      )}

      {/* Sentinel Detector */}
      {hasSentinel && (
        <DetectorCard
          name="Sentinel"
          subtitle="Consented AI CLIP-based"
          frames={aiEvidence}
          getScore={(ev) => ev.sentinel_score}
          getExtra={(ev) =>
            ev.sentinel_classification ? (
              <Badge
                className={`text-[10px] ${
                  ev.sentinel_classification === "AI-GENERATED"
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-green-500/10 text-green-500 border-green-500/20"
                }`}
              >
                {ev.sentinel_classification}
              </Badge>
            ) : null
          }
        />
      )}

      {/* Content Provenance (C2PA) */}
      {provEvidence.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Content Provenance (C2PA)
          </h3>
          <div className="space-y-3">
            {provEvidence.map((ev) => (
              <div key={ev.id} className="p-3 rounded-lg bg-muted/30">
                {ev.title && <p className="text-sm font-medium">{ev.title}</p>}
                {ev.content && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.content}</p>}
                {ev.provenance_data && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Raw provenance data
                    </summary>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 mt-2 overflow-x-auto max-h-[200px] overflow-y-auto">
                      {JSON.stringify(ev.provenance_data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {aiEvidence.length === 0 && provEvidence.length === 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
          <Bot className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No analysis results yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use the buttons above to run AI detection, provenance checks, or news searches.
          </p>
        </div>
      )}
    </div>
  );
}

function AnalysisTriggerButton({
  investigationId,
  taskType,
  label,
  icon,
  onUpdate,
}: {
  investigationId: string;
  taskType: TaskType;
  label: string;
  icon: React.ReactNode;
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/admin/investigations/${investigationId}/automated-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_types: [taskType] }),
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" className="gap-2" onClick={handleClick} disabled={loading}>
      {icon}
      {loading ? "Running..." : label}
    </Button>
  );
}
