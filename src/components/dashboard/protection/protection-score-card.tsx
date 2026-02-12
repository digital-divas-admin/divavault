import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  Shield,
  ShieldCheck,
  Sparkles,
  Crown,
  BarChart3,
  Rocket,
  Compass,
  Smile,
  Images,
  Target,
  Sun,
  Zap,
  ChevronRight,
  CheckCircle2,
  Trophy,
  Info,
  Camera,
} from "lucide-react";
import type { ProtectionScore } from "@/types/protection-score";
import type { LucideIcon } from "lucide-react";

/* ── Tier data constants ─────────────────────────────────────── */

const TIER_GRADIENTS: Record<
  ProtectionScore["tier"],
  { from: string; to: string; glow: string }
> = {
  minimal: { from: "#EF4444", to: "#F97316", glow: "rgba(239,68,68,0.4)" },
  basic: { from: "#F59E0B", to: "#FBBF24", glow: "rgba(245,158,11,0.4)" },
  good: { from: "#EAB308", to: "#A3E635", glow: "rgba(234,179,8,0.4)" },
  strong: { from: "#22C55E", to: "#4ADE80", glow: "rgba(34,197,94,0.4)" },
  excellent: { from: "#10B981", to: "#34D399", glow: "rgba(16,185,129,0.4)" },
};

const TIER_ICONS: Record<ProtectionScore["tier"], LucideIcon> = {
  minimal: ShieldAlert,
  basic: Shield,
  good: ShieldCheck,
  strong: Sparkles,
  excellent: Crown,
};

const TIER_THRESHOLDS: Record<ProtectionScore["tier"], number> = {
  minimal: 0,
  basic: 25,
  good: 50,
  strong: 70,
  excellent: 85,
};

const TIER_ORDER: ProtectionScore["tier"][] = [
  "minimal",
  "basic",
  "good",
  "strong",
  "excellent",
];

const TIER_TAGLINES: Record<ProtectionScore["tier"], string> = {
  minimal: "Just getting started — every photo counts!",
  basic: "Nice progress! Keep adding photos to boost your score.",
  good: "Looking strong! A few more steps to level up.",
  strong: "Almost there — you're in great shape!",
  excellent: "Maximum protection achieved. You're fully covered!",
};

const METRIC_ICONS: Record<string, LucideIcon> = {
  "Angle Coverage": Compass,
  "Expression Coverage": Smile,
  "Photo Count": Images,
  "Average Quality": Sparkles,
  Centroid: Target,
  "Embedding Rate": Zap,
};

/* ── Helper functions ────────────────────────────────────────── */

function getNextTier(
  tier: ProtectionScore["tier"]
): ProtectionScore["tier"] | null {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

function getMilestoneProgress(
  score: number,
  tier: ProtectionScore["tier"]
): number {
  const next = getNextTier(tier);
  if (!next) return 100;
  const current = TIER_THRESHOLDS[tier];
  const target = TIER_THRESHOLDS[next];
  const range = target - current;
  if (range <= 0) return 100;
  return Math.min(Math.round(((score - current) / range) * 100), 100);
}

function getSuggestionIcon(text: string): LucideIcon {
  const lower = text.toLowerCase();
  if (lower.includes("angle")) return Compass;
  if (lower.includes("expression")) return Smile;
  if (lower.includes("photo")) return Camera;
  if (lower.includes("centroid")) return Target;
  if (lower.includes("quality")) return Sun;
  if (lower.includes("embedding")) return Zap;
  return Info;
}

/* ── Component ───────────────────────────────────────────────── */

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
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = (score.score / 100) * circumference;
  const gradient = TIER_GRADIENTS[score.tier];
  const TierIcon = TIER_ICONS[score.tier];
  const nextTier = getNextTier(score.tier);
  const milestoneProgress = getMilestoneProgress(score.score, score.tier);

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

  const gradientId = "score-gradient";
  const glowId = "score-glow";

  return (
    <Card className="border-border/50 bg-card rounded-2xl mb-6 overflow-hidden relative">
      {/* Gradient top accent */}
      <div
        className="h-px w-full"
        style={{
          background: `linear-gradient(to right, transparent, ${gradient.from}, ${gradient.to}, transparent)`,
        }}
      />

      <CardContent className="pt-6 pb-6 space-y-6">
        {/* ── Zone 1: Hero ─────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          {/* Score ring */}
          <div className="relative">
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              className="block"
            >
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={gradient.from} />
                  <stop offset="100%" stopColor={gradient.to} />
                </linearGradient>
                <filter id={glowId}>
                  <feGaussianBlur stdDeviation="4" result="blur" />
                </filter>
              </defs>

              {/* Background track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-muted/20"
                strokeWidth="8"
              />

              {/* Glow circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                transform="rotate(-90 80 80)"
                filter={`url(#${glowId})`}
                opacity="0.4"
                className="score-ring-glow"
              />

              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                transform="rotate(-90 80 80)"
                className="score-ring-progress"
                style={
                  {
                    "--ring-target": circumference - progress,
                    "--ring-circumference": circumference,
                  } as React.CSSProperties
                }
              />
            </svg>

            {/* Center score */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-4xl font-bold score-number"
                style={{ color: gradient.from }}
              >
                {score.score}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                /100
              </span>
            </div>

            {/* Sparkle decorations (score >= 70) */}
            {score.score >= 70 && (
              <>
                <svg
                  className="absolute -top-1 right-2 score-sparkle"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill={gradient.to}
                  style={{ animationDelay: "0s" }}
                >
                  <path d="M6 0L7.2 4.8L12 6L7.2 7.2L6 12L4.8 7.2L0 6L4.8 4.8Z" />
                </svg>
                <svg
                  className="absolute top-4 -left-2 score-sparkle"
                  width="8"
                  height="8"
                  viewBox="0 0 12 12"
                  fill={gradient.from}
                  style={{ animationDelay: "0.8s" }}
                >
                  <path d="M6 0L7.2 4.8L12 6L7.2 7.2L6 12L4.8 7.2L0 6L4.8 4.8Z" />
                </svg>
                <svg
                  className="absolute -bottom-1 left-6 score-sparkle"
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill={gradient.to}
                  style={{ animationDelay: "1.6s" }}
                >
                  <path d="M6 0L7.2 4.8L12 6L7.2 7.2L6 12L4.8 7.2L0 6L4.8 4.8Z" />
                </svg>
              </>
            )}
          </div>

          {/* Tier badge */}
          <Badge
            className="text-xs px-3 py-1 border gap-1.5"
            style={{
              backgroundColor: `${gradient.from}15`,
              color: gradient.from,
              borderColor: `${gradient.from}30`,
            }}
          >
            <TierIcon className="h-3.5 w-3.5" />
            {score.tier.charAt(0).toUpperCase() + score.tier.slice(1)}
          </Badge>

          {/* Encouraging tagline */}
          <p className="text-xs text-muted-foreground text-center max-w-[220px] leading-relaxed">
            {TIER_TAGLINES[score.tier]}
          </p>

          {/* Next milestone strip */}
          {nextTier ? (
            <div className="w-full max-w-[240px] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="capitalize">{score.tier}</span>
                <span className="capitalize">{nextTier}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${milestoneProgress}%`,
                    background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center">
                {TIER_THRESHOLDS[nextTier] - score.score} points to{" "}
                <span className="capitalize">{nextTier}</span>
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-emerald-400 font-medium">
              Max Protection
            </p>
          )}
        </div>

        {/* ── Zone 2: Breakdown → "Your Strengths" ──────── */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <BarChart3 className="h-3.5 w-3.5" />
            Your Strengths
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {rows.map((row, i) => {
              const pct = row.max > 0 ? (row.score / row.max) * 100 : 0;
              const isPerfect = row.score === row.max && row.max > 0;
              const MetricIcon = METRIC_ICONS[row.label] || Zap;

              const content = (
                <div className="flex items-center gap-2.5 py-2 px-2.5">
                  <MetricIcon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      row.sectionLink
                        ? "text-muted-foreground/50 group-hover:text-primary"
                        : "text-muted-foreground/50"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground flex items-center gap-1">
                        {row.label}
                        {isPerfect && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                      </span>
                      <span className="text-[10px] font-mono bg-muted/30 rounded-full px-1.5 py-0.5 text-muted-foreground">
                        {Math.round(row.score)}/{row.max}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-full score-bar-fill"
                        style={
                          {
                            "--bar-width": `${Math.min(pct, 100)}%`,
                            background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
                            animationDelay: `${1.0 + i * 0.1}s`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  </div>
                  {row.sectionLink && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
              );

              if (row.sectionLink) {
                return (
                  <Link
                    key={row.label}
                    href={`/dashboard/your-data?section=${row.sectionLink}`}
                    className="group block rounded-xl hover:bg-muted/10 transition-colors"
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
        </div>

        {/* ── Zone 3: Suggestions → "Next Steps" ──────── */}
        {score.score >= 85 ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="bg-emerald-500/10 rounded-full p-3">
              <Trophy className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-400">
              All caught up!
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Your protection is at maximum. No further action needed.
            </p>
          </div>
        ) : (
          score.suggestions.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Rocket className="h-3.5 w-3.5" />
                Next Steps
              </h4>
              <div className="space-y-2">
                {score.suggestions.map((suggestion, i) => {
                  const SugIcon = getSuggestionIcon(suggestion);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-muted/10 border border-border/30 rounded-xl p-3"
                    >
                      <div className="bg-primary/10 rounded-lg p-1.5 shrink-0 mt-0.5">
                        <SugIcon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">
                        {suggestion}
                      </p>
                    </div>
                  );
                })}

                {/* Educational tip as last card */}
                <div className="flex items-start gap-3 bg-primary/5 border border-border/30 rounded-xl p-3">
                  <div className="bg-primary/10 rounded-lg p-1.5 shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your photos create a facial signature used to scan AI
                    platforms. More diverse photos mean more accurate detection.
                  </p>
                </div>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
