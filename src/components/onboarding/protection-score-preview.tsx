"use client";

import { useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProtectionScore } from "@/types/protection-score";

const TIER_COLORS: Record<ProtectionScore["tier"], string> = {
  minimal: "bg-red-500/10 text-red-500 border-red-500/20",
  basic: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  good: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  strong: "bg-green-500/10 text-green-500 border-green-500/20",
  excellent: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const TIER_STROKE: Record<ProtectionScore["tier"], string> = {
  minimal: "stroke-red-500",
  basic: "stroke-amber-500",
  good: "stroke-yellow-500",
  strong: "stroke-green-500",
  excellent: "stroke-emerald-500",
};

const TIER_MESSAGES: Record<ProtectionScore["tier"], string> = {
  minimal: "Upload more photos to improve your protection.",
  basic: "Good start. Add more angles and expressions.",
  good: "Solid coverage. A few more photos will strengthen detection.",
  strong: "Great protection. Your likeness is well covered.",
  excellent: "Maximum protection. Your facial signature is comprehensive.",
};

export function ProtectionScorePreview() {
  const [data, setData] = useState<ProtectionScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchScore() {
      try {
        const res = await fetch("/api/protection-score");
        if (!res.ok) throw new Error("Failed to fetch");
        const result = await res.json();
        setData(result);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchScore();
  }, []);

  if (error || (!loading && !data)) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const score = data!;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score.score / 100) * circumference;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 p-4">
      {/* Circular progress ring */}
      <div className="relative flex-shrink-0">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/20"
            strokeWidth="4"
          />
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            className={TIER_STROKE[score.tier]}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            transform="rotate(-90 34 34)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Score info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground">
            Protection Score: {score.score}/100
          </span>
          <Badge
            className={`text-[10px] px-1.5 py-0 border ${TIER_COLORS[score.tier]}`}
          >
            {score.tier}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {TIER_MESSAGES[score.tier]}
        </p>
      </div>
    </div>
  );
}
