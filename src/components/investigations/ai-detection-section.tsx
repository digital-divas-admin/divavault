import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAiScoreBarColor, getAiScoreTextColor } from "@/lib/investigation-utils";
import type { InvestigationEvidence } from "@/types/investigations";

/** Aggregate multiple per-frame AI detection evidence into a video-level verdict. */
function aggregateDetection(items: InvestigationEvidence[]) {
  const scores = items
    .filter((e) => e.ai_detection_score != null)
    .map((e) => e.ai_detection_score!);

  if (scores.length === 0) return null;

  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Collect generators, pick the one that appears most / has highest score
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

  return { maxScore, avgScore, topGenerator, framesAnalyzed: scores.length };
}

function getVerdictLabel(score: number): string {
  if (score >= 0.85) return "Very likely AI-generated";
  if (score >= 0.7) return "Likely AI-generated";
  if (score >= 0.4) return "Possibly AI-generated";
  if (score >= 0.15) return "Unlikely AI-generated";
  return "No AI generation detected";
}

export function AiDetectionSection({
  evidence,
}: {
  evidence: InvestigationEvidence[];
}) {
  const aiItems = evidence.filter(
    (e) => e.evidence_type === "ai_detection" && e.ai_detection_score != null
  );
  const agg = aggregateDetection(aiItems);
  if (!agg) return null;

  const { maxScore, avgScore, topGenerator, framesAnalyzed } = agg;
  const verdictLabel = getVerdictLabel(maxScore);

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
        {framesAnalyzed} frame{framesAnalyzed !== 1 ? "s" : ""} from this video were
        analyzed using Hive AI&apos;s detection model. If sampled frames show AI generation,
        the entire video is considered AI-generated.
      </p>

      {/* Main verdict */}
      <div className="bg-muted/50 border border-border rounded-lg p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">Overall AI Probability</span>
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
        <p className={`text-sm font-semibold ${getAiScoreTextColor(maxScore)}`}>
          {verdictLabel}
        </p>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
        <div className="bg-muted/30 rounded-lg p-3">
          <span className="block text-xs text-muted-foreground mb-1">Peak Score</span>
          <span className={`text-lg font-bold ${getAiScoreTextColor(maxScore)}`}>
            {(maxScore * 100).toFixed(1)}%
          </span>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <span className="block text-xs text-muted-foreground mb-1">Average Score</span>
          <span className={`text-lg font-bold ${getAiScoreTextColor(avgScore)}`}>
            {(avgScore * 100).toFixed(1)}%
          </span>
        </div>
        {topGenerator && (
          <div className="bg-muted/30 rounded-lg p-3 col-span-2 sm:col-span-1">
            <span className="block text-xs text-muted-foreground mb-1">Likely Generator</span>
            <Badge className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
              {topGenerator}
            </Badge>
          </div>
        )}
      </div>

      {/* Per-frame breakdown */}
      {aiItems.length > 1 && (
        <div className="mt-5 pt-4 border-t border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
            Per-Frame Breakdown
          </span>
          <div className="space-y-2">
            {aiItems.map((item) => {
              const score = item.ai_detection_score!;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                    Frame #{item.frame_number}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getAiScoreBarColor(score)}`}
                      style={{ width: `${Math.min(score * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-14 text-right ${getAiScoreTextColor(score)}`}>
                    {(score * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border">
        Analysis powered by Hive AI. Scores represent the probability that content was generated by an AI model.
      </p>
    </section>
  );
}
