import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lightbulb, ChevronRight } from "lucide-react";
import type { ProtectionScore } from "@/types/protection-score";

const TIER_COLORS: Record<ProtectionScore["tier"], string> = {
  minimal: "text-red-500",
  basic: "text-amber-500",
  good: "text-yellow-500",
  strong: "text-green-500",
  excellent: "text-emerald-500",
};

const TIER_STROKE: Record<ProtectionScore["tier"], string> = {
  minimal: "stroke-red-500",
  basic: "stroke-amber-500",
  good: "stroke-yellow-500",
  strong: "stroke-green-500",
  excellent: "stroke-emerald-500",
};

const TIER_BADGE: Record<ProtectionScore["tier"], string> = {
  minimal: "bg-red-500/10 text-red-500 border-red-500/20",
  basic: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  good: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  strong: "bg-green-500/10 text-green-500 border-green-500/20",
  excellent: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const TIER_BAR_BG: Record<ProtectionScore["tier"], string> = {
  minimal: "bg-red-500",
  basic: "bg-amber-500",
  good: "bg-yellow-500",
  strong: "bg-green-500",
  excellent: "bg-emerald-500",
};

interface ProtectionScoreCardProps {
  score: ProtectionScore;
}

interface BreakdownRow {
  label: string;
  score: number;
  max: number;
  sectionLink?: string;
}

export function ProtectionScoreCard({ score }: ProtectionScoreCardProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (score.score / 100) * circumference;
  const barColor = TIER_BAR_BG[score.tier];

  const rows: BreakdownRow[] = [
    {
      label: "Angle Coverage",
      score: score.breakdown.angleCoverage.score,
      max: score.breakdown.angleCoverage.max,
      sectionLink: "angles",
    },
    {
      label: "Expression Coverage",
      score: score.breakdown.expressionCoverage.score,
      max: score.breakdown.expressionCoverage.max,
      sectionLink: "expressions",
    },
    {
      label: "Photo Count",
      score: score.breakdown.photoCount.score,
      max: score.breakdown.photoCount.max,
      sectionLink: "body",
    },
    {
      label: "Average Quality",
      score: score.breakdown.averageQuality.score,
      max: score.breakdown.averageQuality.max,
    },
    {
      label: "Centroid",
      score: score.breakdown.centroidComputed.score,
      max: score.breakdown.centroidComputed.max,
    },
    {
      label: "Embedding Rate",
      score: score.breakdown.embeddingSuccessRate.score,
      max: score.breakdown.embeddingSuccessRate.max,
    },
  ];

  return (
    <Card className="border-border/50 bg-card rounded-2xl mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Protection Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score ring + tier */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-muted/20"
                strokeWidth="6"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                className={TIER_STROKE[score.tier]}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-bold ${TIER_COLORS[score.tier]}`}
              >
                {score.score}
              </span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <Badge
            className={`text-xs px-2.5 py-0.5 border ${TIER_BADGE[score.tier]}`}
          >
            {score.tier.charAt(0).toUpperCase() + score.tier.slice(1)}
          </Badge>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Breakdown
          </h4>
          {rows.map((row) => {
            const pct = row.max > 0 ? (row.score / row.max) * 100 : 0;
            const content = (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground flex items-center gap-1">
                    {row.label}
                    {row.sectionLink && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(row.score)}/{row.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </>
            );

            if (row.sectionLink) {
              return (
                <Link
                  key={row.label}
                  href={`/dashboard/your-data?section=${row.sectionLink}`}
                  className="block -mx-2 px-2 py-1 rounded-lg hover:bg-muted/10 transition-colors"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={row.label}>
                {content}
              </div>
            );
          })}
        </div>

        {/* Suggestions */}
        {score.suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Lightbulb className="h-3.5 w-3.5" />
              How to improve
            </h4>
            <ul className="space-y-1.5">
              {score.suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground leading-relaxed pl-3 relative before:absolute before:left-0 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:bg-primary/50"
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Educational copy */}
        <p className="text-xs text-muted-foreground/70 leading-relaxed border-t border-border/30 pt-4">
          Your photos create a facial signature used to scan AI platforms. More
          diverse photos mean more accurate detection.
        </p>
      </CardContent>
    </Card>
  );
}
