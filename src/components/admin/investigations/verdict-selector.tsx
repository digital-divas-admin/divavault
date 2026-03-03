"use client";

import { Badge } from "@/components/ui/badge";
import type { InvestigationVerdict } from "@/types/investigations";
import { VERDICT_LABELS, VERDICT_COLORS } from "@/types/investigations";

const verdicts: (InvestigationVerdict | null)[] = [
  null,
  "confirmed_fake",
  "likely_fake",
  "inconclusive",
  "likely_real",
  "confirmed_real",
];

interface VerdictSelectorProps {
  verdict: InvestigationVerdict | null;
  confidenceScore: number | null;
  onVerdictChange: (verdict: InvestigationVerdict | null) => void;
  onConfidenceChange: (score: number) => void;
}

export function VerdictSelector({
  verdict,
  confidenceScore,
  onVerdictChange,
  onConfidenceChange,
}: VerdictSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Verdict</label>
        <div className="flex flex-wrap gap-2">
          {verdicts.map((v) => (
            <button
              key={v || "none"}
              onClick={() => onVerdictChange(v)}
              className={`transition-all ${
                verdict === v ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
              }`}
            >
              {v ? (
                <Badge className={`${VERDICT_COLORS[v]} cursor-pointer`}>
                  {VERDICT_LABELS[v]}
                </Badge>
              ) : (
                <Badge variant="outline" className="cursor-pointer">
                  Not Set
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Confidence Score
          </label>
          <span className="text-sm text-muted-foreground">
            {confidenceScore !== null ? `${confidenceScore}%` : "Not set"}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={confidenceScore ?? 50}
          onChange={(e) => onConfidenceChange(Number(e.target.value))}
          disabled={verdict === null}
          className="w-full accent-primary disabled:opacity-40"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
