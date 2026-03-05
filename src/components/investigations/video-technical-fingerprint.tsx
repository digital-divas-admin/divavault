import { Fingerprint, Check, X, Clock, Monitor, Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  computeTechnicalFingerprint,
  getAiScoreBarColor,
  getAiScoreTextColor,
  AI_GENERATORS,
  AI_GENERATOR_DURATION_LIST,
  MIN_CANDIDATE_MATCHES,
} from "@/lib/investigation-utils";
import type { InvestigationMedia } from "@/types/investigations";

function getResolutionLabel(h: number): string {
  if (h >= 2140 && h <= 2180) return "4K";
  if (h >= 1060 && h <= 1100) return "1080p";
  if (h >= 710 && h <= 740) return "720p";
  if (h >= 530 && h <= 550) return "540p";
  if (h >= 470 && h <= 490) return "480p";
  return `${h}p`;
}

const KNOWN_AI_DURATIONS = AI_GENERATOR_DURATION_LIST;

function MatchIcon({ matches }: { matches: boolean }) {
  return matches ? (
    <Check className="w-4 h-4 text-red-500" />
  ) : (
    <X className="w-4 h-4 text-green-500" />
  );
}

export function VideoTechnicalFingerprint({
  media,
}: {
  media: InvestigationMedia[];
}) {
  // Find the first video with usable metadata
  const video = media.find(
    (m) =>
      m.media_type === "video" &&
      (m.duration_seconds != null || m.fps != null || m.resolution_width != null)
  );

  if (!video) return null;

  const result = computeTechnicalFingerprint(video);
  if (!result) return null;

  const roundedDuration = video.duration_seconds != null ? Math.round(video.duration_seconds) : null;

  return (
    <section
      id="technical-fingerprint"
      className="bg-card border border-border rounded-xl p-6 sm:p-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground">
          Video Technical Fingerprint
        </h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        AI video generators produce clips with characteristic technical signatures — specific
        durations, frame rates, and resolutions. This analysis compares the video&apos;s metadata
        against a database of {AI_GENERATORS.length} known AI generators.
      </p>

      {/* Overall Score Bar */}
      <div className="bg-muted/50 border border-border rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">
            AI Generator Match Score
          </span>
          <span
            className={`text-2xl font-bold ${getAiScoreTextColor(result.normalizedScore)}`}
          >
            {result.overallScore}
          </span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${getAiScoreBarColor(result.normalizedScore)}`}
            style={{ width: `${result.overallScore}%` }}
          />
        </div>
        <p
          className={`text-sm font-semibold ${getAiScoreTextColor(result.normalizedScore)}`}
        >
          {result.verdict}
        </p>
      </div>

      {/* Three-Column Signal Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Duration Signal */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Duration
            </span>
          </div>
          {roundedDuration != null ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold text-foreground">
                  {roundedDuration}s
                </span>
                <MatchIcon matches={result.durationSignal.matches} />
              </div>
              {result.durationSignal.matches ? (
                <p className="text-xs text-red-400 mb-3">
                  Matches {result.durationSignal.generators.length} AI generator
                  {result.durationSignal.generators.length !== 1 ? "s" : ""}
                </p>
              ) : (
                <p className="text-xs text-green-400 mb-3">
                  Not a standard AI output duration
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {KNOWN_AI_DURATIONS.map((d) => (
                  <span
                    key={d}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      d === roundedDuration
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-muted/50 text-muted-foreground border-border"
                    }`}
                  >
                    {d}s
                  </span>
                ))}
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No data</span>
          )}
        </div>

        {/* FPS Signal */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Film className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Frame Rate
            </span>
          </div>
          {video.fps != null ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold text-foreground">
                  {Math.round(video.fps)} fps
                </span>
                <MatchIcon matches={result.fpsSignal.matches} />
              </div>
              {result.fpsSignal.matches ? (
                <p className="text-xs text-red-400">
                  {Math.round(video.fps) === 24
                    ? "24fps is the default for 10 of 11 AI generators"
                    : `Matches ${result.fpsSignal.generators.length} AI generator${result.fpsSignal.generators.length !== 1 ? "s" : ""}`}
                </p>
              ) : (
                <p className="text-xs text-green-400">
                  {Math.round(video.fps) >= 30
                    ? `${Math.round(video.fps)}fps is typical of real camera footage`
                    : "Not a standard AI generator frame rate"}
                </p>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No data</span>
          )}
        </div>

        {/* Resolution Signal */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resolution
            </span>
          </div>
          {video.resolution_width && video.resolution_height ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold text-foreground">
                  {getResolutionLabel(video.resolution_height)}
                </span>
                <MatchIcon matches={result.resolutionSignal.matches} />
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {video.resolution_width}&times;{video.resolution_height}
              </p>
              {result.resolutionSignal.matches ? (
                <p className="text-xs text-red-400">
                  Matches {result.resolutionSignal.generators.length} AI generator
                  {result.resolutionSignal.generators.length !== 1 ? "s" : ""}
                </p>
              ) : (
                <p className="text-xs text-green-400">
                  Not a standard AI output resolution
                </p>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No data</span>
          )}
        </div>
      </div>

      {/* Candidate Generators Panel */}
      {result.topCandidates.length > 0 &&
        result.topCandidates[0].matchCount >= MIN_CANDIDATE_MATCHES && (
          <div className="bg-muted/30 rounded-lg p-4 mb-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
              Candidate AI Generators
            </span>
            <div className="space-y-2">
              {result.topCandidates
                .filter((c) => c.matchCount >= MIN_CANDIDATE_MATCHES)
                .map((candidate) => (
                  <div
                    key={candidate.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {candidate.name}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map((dot) => (
                          <div
                            key={dot}
                            className={`w-2 h-2 rounded-full ${
                              dot <= candidate.matchCount
                                ? "bg-red-500"
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {candidate.matchedParams.map((param) => (
                        <Badge
                          key={param}
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {param}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground pt-3 border-t border-border">
        Based on verified specifications from {AI_GENERATORS.length} AI video generators
        including Sora, Runway, Kling, Pika, Luma, Veo, Hailuo, HunyuanVideo, and Seedance.
        Database last updated March 2026.
      </p>
    </section>
  );
}
