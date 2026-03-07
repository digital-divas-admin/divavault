import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAiScoreBarColor, getAiScoreTextColor, getAiVerdictLabel } from "@/lib/investigation-utils";
import type { InvestigationEvidence } from "@/types/investigations";

interface HiveAggregation {
  maxScore: number;
  avgScore: number;
  topGenerator: string | null;
}

interface SentinelAggregation {
  maxScore: number;
  avgScore: number;
  classification: string;
}

interface AggregatedDetection {
  hive: HiveAggregation | null;
  sentinel: SentinelAggregation | null;
  framesAnalyzed: number;
}

/** Aggregate multiple per-frame AI detection evidence into separate model summaries. */
function aggregateDetection(items: InvestigationEvidence[]): AggregatedDetection | null {
  if (items.length === 0) return null;

  // Hive aggregation
  const hiveScores = items
    .filter((e) => e.ai_detection_score != null)
    .map((e) => e.ai_detection_score!);

  let hive: HiveAggregation | null = null;
  if (hiveScores.length > 0) {
    const maxScore = Math.max(...hiveScores);
    const avgScore = hiveScores.reduce((a, b) => a + b, 0) / hiveScores.length;

    // Collect generators, pick the one with highest score
    const genCounts = new Map<string, { count: number; bestScore: number }>();
    for (const item of items) {
      const gen = item.ai_detection_generator;
      if (!gen) continue;
      const existing = genCounts.get(gen) || { count: 0, bestScore: 0 };
      existing.count++;
      existing.bestScore = Math.max(existing.bestScore, item.ai_detection_score ?? 0);
      genCounts.set(gen, existing);
    }

    let topGenerator: string | null = null;
    let topGenScore = 0;
    for (const [gen, { bestScore }] of genCounts) {
      if (bestScore > topGenScore) {
        topGenerator = gen;
        topGenScore = bestScore;
      }
    }

    hive = { maxScore, avgScore, topGenerator };
  }

  // Sentinel aggregation
  const sentinelScores = items
    .filter((e) => e.sentinel_score != null)
    .map((e) => e.sentinel_score!);

  let sentinel: SentinelAggregation | null = null;
  if (sentinelScores.length > 0) {
    const maxScore = Math.max(...sentinelScores);
    const avgScore = sentinelScores.reduce((a, b) => a + b, 0) / sentinelScores.length;

    // Most common classification
    const aiCount = items.filter((e) => e.sentinel_classification === "AI-GENERATED").length;
    const classification = aiCount > sentinelScores.length / 2 ? "AI-GENERATED" : "REAL";

    sentinel = { maxScore, avgScore, classification };
  }

  if (!hive && !sentinel) return null;

  const framesAnalyzed = Math.max(hiveScores.length, sentinelScores.length);
  return { hive, sentinel, framesAnalyzed };
}

function getSentinelVerdictLabel(score: number, classification: string): string {
  if (classification === "AI-GENERATED") {
    if (score >= 0.9) return "High confidence AI-generated";
    if (score >= 0.7) return "Likely AI-generated";
    return "Possibly AI-generated";
  }
  if (score <= 0.1) return "High confidence real";
  if (score <= 0.3) return "Likely real";
  return "Inconclusive";
}

function ModelCard({
  title,
  subtitle,
  maxScore,
  avgScore,
  verdictLabel,
  extra,
}: {
  title: string;
  subtitle: string;
  maxScore: number;
  avgScore: number;
  verdictLabel: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/50 border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </div>

      <div className="flex items-center justify-between mb-2 mt-3">
        <span className="text-xs text-muted-foreground">Peak Score</span>
        <span className={`text-2xl font-bold ${getAiScoreTextColor(maxScore)}`}>
          {(maxScore * 100).toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${getAiScoreBarColor(maxScore)}`}
          style={{ width: `${Math.min(maxScore * 100, 100)}%` }}
        />
      </div>
      <p className={`text-sm font-semibold ${getAiScoreTextColor(maxScore)} mb-3`}>
        {verdictLabel}
      </p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Avg: <span className={`font-semibold ${getAiScoreTextColor(avgScore)}`}>{(avgScore * 100).toFixed(1)}%</span></span>
        {extra}
      </div>
    </div>
  );
}

export function AiDetectionSection({
  evidence,
}: {
  evidence: InvestigationEvidence[];
}) {
  const aiItems = evidence.filter(
    (e) => e.evidence_type === "ai_detection" && (e.ai_detection_score != null || e.sentinel_score != null)
  );
  const agg = aggregateDetection(aiItems);
  if (!agg) return null;

  const { hive, sentinel, framesAnalyzed } = agg;
  const hasBoth = hive && sentinel;

  return (
    <section id="ai-detection" className="bg-card border border-border rounded-xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground">
          AI Detection Analysis
        </h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        {framesAnalyzed} frame{framesAnalyzed !== 1 ? "s" : ""} analyzed using{" "}
        {hasBoth
          ? "two independent AI detection models"
          : "an AI detection model"}
        .
      </p>

      {/* Model cards */}
      <div className={`grid gap-4 mb-5 ${hasBoth ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        {hive && (
          <ModelCard
            title="Hive AI"
            subtitle="thehive.ai"
            maxScore={hive.maxScore}
            avgScore={hive.avgScore}
            verdictLabel={getAiVerdictLabel(hive.maxScore)}
            extra={
              hive.topGenerator ? (
                <span className="flex items-center gap-1">
                  Gen:{" "}
                  <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/20">
                    {hive.topGenerator}
                  </Badge>
                </span>
              ) : undefined
            }
          />
        )}

        {sentinel && (
          <ModelCard
            title="Sentinel"
            subtitle="Consented AI"
            maxScore={sentinel.maxScore}
            avgScore={sentinel.avgScore}
            verdictLabel={getSentinelVerdictLabel(sentinel.maxScore, sentinel.classification)}
            extra={
              <Badge className={`text-[10px] px-1.5 py-0 ${
                sentinel.classification === "AI-GENERATED"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-green-500/10 text-green-400 border-green-500/20"
              }`}>
                {sentinel.classification}
              </Badge>
            }
          />
        )}
      </div>

      {/* Per-frame breakdown */}
      {aiItems.length > 1 && (
        <div className="pt-4 border-t border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
            Per-Frame Breakdown
          </span>
          <div className="space-y-2">
            {aiItems.map((item) => {
              const hiveScore = item.ai_detection_score;
              const sentScore = item.sentinel_score;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                    Frame #{item.frame_number}
                  </span>
                  {hiveScore != null && (
                    <>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getAiScoreBarColor(hiveScore)}`}
                          style={{ width: `${Math.min(hiveScore * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-14 text-right ${getAiScoreTextColor(hiveScore)}`}>
                        {(hiveScore * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                  {sentScore != null && (
                    <>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getAiScoreBarColor(sentScore)}`}
                          style={{ width: `${Math.min(sentScore * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-14 text-right ${getAiScoreTextColor(sentScore)}`}>
                        {(sentScore * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {/* Column labels */}
          {hasBoth && (
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="w-20 flex-shrink-0" />
              <span className="flex-1 text-center">Hive AI</span>
              <span className="w-14" />
              <span className="flex-1 text-center">Sentinel</span>
              <span className="w-14" />
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border">
        {hive && <>Hive AI detection by thehive.ai. </>}
        {sentinel && <>Sentinel is Consented AI&apos;s internal CLIP-based detection model. </>}
        Scores represent the probability that content was generated by an AI model.
      </p>
    </section>
  );
}
