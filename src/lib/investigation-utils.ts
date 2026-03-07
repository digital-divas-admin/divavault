/** AI score severity color — red >=70%, amber >=30%, green <30%. */
export function getAiScoreBarColor(score: number): string {
  if (score >= 0.7) return "bg-red-500";
  if (score >= 0.3) return "bg-amber-500";
  return "bg-green-500";
}

/** AI score severity text color — red >=70%, amber >=30%, green <30%. */
export function getAiScoreTextColor(score: number): string {
  if (score >= 0.7) return "text-red-500";
  if (score >= 0.3) return "text-amber-500";
  return "text-green-500";
}

/** AI score badge color classes (opaque background + white text). */
export function getAiScoreBadgeColor(score: number): string {
  if (score >= 0.7) return "bg-red-500/90 text-white";
  if (score >= 0.3) return "bg-amber-500/90 text-white";
  return "bg-green-500/90 text-white";
}

export const SITE_BASE_URL = "https://www.consentedai.com";

export function investigationUrl(slug: string): string {
  return `${SITE_BASE_URL}/investigations/${slug}`;
}

/**
 * Generate a URL-safe slug from a title.
 * Appends a short random suffix to avoid collisions.
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

/**
 * Detect the platform from a URL string.
 */
export function detectPlatform(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("youtube") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("twitter") || hostname.includes("x.com")) return "x";
    if (hostname.includes("tiktok")) return "tiktok";
    if (hostname.includes("instagram")) return "instagram";
    if (hostname.includes("facebook") || hostname.includes("fb.com")) return "facebook";
    if (hostname.includes("reddit")) return "reddit";
    if (hostname.includes("telegram")) return "telegram";
    if (hostname.includes("rumble")) return "rumble";
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a reverse image search URL for a given engine.
 * The imageUrl should be a publicly accessible signed URL.
 */
export function buildReverseSearchUrl(engine: "tineye" | "google_lens" | "yandex", imageUrl: string): string {
  const encoded = encodeURIComponent(imageUrl);
  switch (engine) {
    case "tineye":
      return `https://tineye.com/search?url=${encoded}`;
    case "google_lens":
      return `https://lens.google.com/uploadbyurl?url=${encoded}`;
    case "yandex":
      return `https://yandex.com/images/search?rpt=imageview&url=${encoded}`;
  }
}

/**
 * Format a confidence score as a display string.
 */
export function formatConfidence(score: number | null): string {
  if (score === null) return "Not set";
  return `${score}%`;
}

/**
 * Get the storage folder prefix for an investigation.
 */
export function getStoragePath(investigationId: string, subfolder: "media" | "frames" | "evidence"): string {
  return `${investigationId}/${subfolder}`;
}

const TWEET_URL_RE = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;

/**
 * Extract the tweet ID from a Twitter/X status URL, or null if not a tweet URL.
 */
export function extractTweetId(url: string): string | null {
  const match = url.match(TWEET_URL_RE);
  return match ? match[1] : null;
}

/**
 * Check whether a URL points to a specific tweet on Twitter/X.
 */
export function isTweetUrl(url: string | null | undefined): boolean {
  return !!url && extractTweetId(url) !== null;
}

/**
 * Check whether a URL points to an Instagram post or reel.
 */
export function isInstagramUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.includes("instagram");
  } catch {
    return false;
  }
}

/**
 * Format a duration in seconds to a human-readable string.
 * < 60s → "12s", 1-60min → "2m 34s", 60min+ → "1h 2m 34s"
 */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return rem > 0 ? `${h}h ${remM}m ${rem}s` : remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

// --- AI Video Generator Database ---

export interface AiGeneratorProfile {
  name: string;
  durations: number[];
  maxDuration: number;
  resolutions: [number, number][];
  fpsOptions: number[];
}

export const AI_GENERATORS: AiGeneratorProfile[] = [
  { name: "Sora 2", durations: [5, 10, 15], maxDuration: 25, resolutions: [[1280,720],[1920,1080]], fpsOptions: [24] },
  { name: "Runway Gen-3", durations: [5, 10], maxDuration: 10, resolutions: [[1280,720]], fpsOptions: [24] },
  { name: "Runway Gen-4", durations: [5, 10], maxDuration: 10, resolutions: [[1280,720],[1920,1080]], fpsOptions: [24] },
  { name: "Kling", durations: [5, 10], maxDuration: 180, resolutions: [[1280,720],[1920,1080]], fpsOptions: [30] },
  { name: "Pika", durations: [5, 10], maxDuration: 10, resolutions: [[1280,720],[1920,1080]], fpsOptions: [24] },
  { name: "Luma Ray2", durations: [5, 10], maxDuration: 10, resolutions: [[960,540],[1280,720],[1920,1080]], fpsOptions: [24] },
  { name: "Google Veo 2", durations: [5, 6, 7, 8], maxDuration: 8, resolutions: [[1280,720]], fpsOptions: [24] },
  { name: "Google Veo 3", durations: [4, 6, 8], maxDuration: 8, resolutions: [[1280,720],[1920,1080]], fpsOptions: [24] },
  { name: "Minimax/Hailuo", durations: [6, 10], maxDuration: 10, resolutions: [[1920,1080]], fpsOptions: [24] },
  { name: "HunyuanVideo", durations: [5], maxDuration: 5, resolutions: [[854,480],[1280,720]], fpsOptions: [24] },
  { name: "Seedance", durations: [5, 10], maxDuration: 12, resolutions: [[854,480],[1920,1080]], fpsOptions: [24] },
];

/** Derived set of all known AI generator durations. */
const AI_GENERATOR_DURATIONS = new Set(AI_GENERATORS.flatMap((g) => g.durations));

/** Sorted array of all known AI generator durations (for display). */
export const AI_GENERATOR_DURATION_LIST: number[] = Array.from(AI_GENERATOR_DURATIONS).sort((a, b) => a - b);

/** Minimum candidate match count to surface a generator as a candidate. */
export const MIN_CANDIDATE_MATCHES = 2;

/**
 * Check whether a video duration matches a known AI generator output length.
 */
export function isAiGeneratorDuration(seconds: number | null | undefined): boolean {
  if (seconds == null) return false;
  return AI_GENERATOR_DURATIONS.has(Math.round(seconds));
}

/** Match generators whose duration presets include this value. */
export function matchGeneratorsByDuration(seconds: number): string[] {
  const rounded = Math.round(seconds);
  return AI_GENERATORS.filter((g) => g.durations.includes(rounded)).map((g) => g.name);
}

/** Match generators whose FPS options include this value. */
export function matchGeneratorsByFps(fps: number): string[] {
  const rounded = Math.round(fps);
  return AI_GENERATORS.filter((g) => g.fpsOptions.includes(rounded)).map((g) => g.name);
}

/** Match generators whose resolutions include this height (with ±20px tolerance). */
export function matchGeneratorsByResolution(w: number, h: number): string[] {
  return AI_GENERATORS.filter((g) =>
    g.resolutions.some(([rw, rh]) => Math.abs(rh - h) <= 20 && Math.abs(rw - w) <= 20)
  ).map((g) => g.name);
}

export interface TechnicalFingerprintResult {
  overallScore: number;
  normalizedScore: number;
  durationSignal: { matches: boolean; generators: string[] };
  fpsSignal: { matches: boolean; generators: string[] };
  resolutionSignal: { matches: boolean; generators: string[] };
  topCandidates: { name: string; matchCount: number; matchedParams: string[] }[];
  verdict: string;
}

/** Compute a technical fingerprint score from video metadata. */
export function computeTechnicalFingerprint(media: {
  duration_seconds?: number | null;
  fps?: number | null;
  resolution_width?: number | null;
  resolution_height?: number | null;
}): TechnicalFingerprintResult | null {
  const { duration_seconds, fps, resolution_width, resolution_height } = media;
  if (duration_seconds == null && fps == null && resolution_width == null) return null;

  let score = 0;

  // Duration signal
  const durGens = duration_seconds != null ? matchGeneratorsByDuration(duration_seconds) : [];
  const durMatches = durGens.length > 0;
  if (durMatches) score += 40;

  // FPS signal
  const fpsGens = fps != null ? matchGeneratorsByFps(fps) : [];
  const fpsMatches = fpsGens.length > 0;
  if (fpsMatches) score += 25;

  // Resolution signal
  const resGens = resolution_width != null && resolution_height != null
    ? matchGeneratorsByResolution(resolution_width, resolution_height)
    : [];
  const resMatches = resGens.length > 0;
  if (resMatches) score += 20;

  // Multi-param match bonus
  const matchedCount = [durMatches, fpsMatches, resMatches].filter(Boolean).length;
  if (matchedCount >= 2) score += 15;

  score = Math.min(100, score);

  // Build candidate list in a single pass
  const candidateMap = new Map<string, string[]>();
  for (const [label, gens] of [["duration", durGens], ["fps", fpsGens], ["resolution", resGens]] as const) {
    for (const name of gens) {
      const existing = candidateMap.get(name);
      if (existing) existing.push(label);
      else candidateMap.set(name, [label]);
    }
  }

  const topCandidates = Array.from(candidateMap.entries())
    .map(([name, params]) => ({ name, matchCount: params.length, matchedParams: params }))
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 6);

  // Verdict text
  let verdict: string;
  if (score >= 80) verdict = "Technical metadata strongly matches known AI video generators";
  else if (score >= 55) verdict = "Technical metadata is consistent with AI-generated video";
  else if (score >= 25) verdict = "Some technical indicators overlap with AI generators";
  else verdict = "Technical metadata does not match known AI generator patterns";

  return {
    overallScore: score,
    normalizedScore: score / 100,
    durationSignal: { matches: durMatches, generators: durGens },
    fpsSignal: { matches: fpsMatches, generators: fpsGens },
    resolutionSignal: { matches: resMatches, generators: resGens },
    topCandidates,
    verdict,
  };
}

/**
 * Estimate reading time for an investigation (minutes).
 */
export function estimateReadTime(investigation: {
  summary?: string | null;
  methodology?: string | null;
  description?: string | null;
  evidence: { content?: string | null }[];
}): number {
  let words = 0;
  if (investigation.summary) words += investigation.summary.split(/\s+/).length;
  if (investigation.methodology) words += investigation.methodology.split(/\s+/).length;
  if (investigation.description) words += investigation.description.split(/\s+/).length;
  for (const e of investigation.evidence) {
    if (e.content) words += e.content.split(/\s+/).length;
  }
  return Math.max(1, Math.ceil(words / 200));
}

/** Extract the bare domain from a URL, stripping `www.` prefix. Returns "" on invalid URLs. */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** AI detection verdict label from a 0-1 score (Hive-style thresholds). */
export function getAiVerdictLabel(score: number): string {
  if (score >= 0.85) return "Very likely AI-generated";
  if (score >= 0.7) return "Likely AI-generated";
  if (score >= 0.4) return "Possibly AI-generated";
  if (score >= 0.15) return "Unlikely AI-generated";
  return "No AI generation detected";
}

/** Tasks pending/running longer than this are considered stale. */
export const TASK_STALE_MS = 30 * 60 * 1000; // 30 minutes

/** Check whether a task is actively pending or running (not stale). */
export function isTaskActive(task: { status: string; created_at: string }): boolean {
  return (
    (task.status === "pending" || task.status === "running") &&
    Date.now() - new Date(task.created_at).getTime() < TASK_STALE_MS
  );
}

/** Parse the AI triage note format `[AI:high|medium|low] reason`. */
export function parseTriageNote(notes: string | null): { relevance: "high" | "medium" | "low"; reason: string } | null {
  const match = notes?.match(/^\[AI:(high|medium|low)\]\s*(.*)/);
  return match ? { relevance: match[1] as "high" | "medium" | "low", reason: match[2] } : null;
}

// --- Media Corroboration ---

import type { ReverseSearchResult, ReverseSearchEngine } from "@/types/investigations";

export type OutletTier = "major" | "national" | "local" | "social" | "unknown";

export const CORROBORATION_ENGINES: readonly ReverseSearchEngine[] = [
  "news_search",
  "wire_search",
  "google_lens",
  "ap_archive",
  "getty_editorial",
  "manual",
] as const;

export const OUTLET_TIER_STYLES: Record<OutletTier, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  national: { label: "National", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  local: { label: "Local", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  social: { label: "Social", className: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  unknown: { label: "Unknown", className: "bg-muted text-muted-foreground" },
};

const OUTLET_TIERS: Record<string, "major" | "national" | "social"> = {
  "apnews.com": "major",
  "reuters.com": "major",
  "bbc.com": "major",
  "bbc.co.uk": "major",
  "nytimes.com": "major",
  "washingtonpost.com": "major",
  "theguardian.com": "major",
  "cnn.com": "major",
  "nbcnews.com": "national",
  "abcnews.go.com": "national",
  "cbsnews.com": "national",
  "foxnews.com": "national",
  "usatoday.com": "national",
  "sky.com": "national",
  "itv.com": "national",
  "channel4.com": "national",
  "twitter.com": "social",
  "x.com": "social",
  "reddit.com": "social",
  "facebook.com": "social",
  "instagram.com": "social",
  "tiktok.com": "social",
  "youtube.com": "social",
};

export function getOutletTier(domain: string | null | undefined): OutletTier {
  if (!domain) return "unknown";
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (OUTLET_TIERS[d]) return OUTLET_TIERS[d];
  // Check if it's a social platform subdomain
  for (const [key, tier] of Object.entries(OUTLET_TIERS)) {
    if (d.endsWith(`.${key}`)) return tier;
  }
  // Any .com/.co.uk/.org domain is assumed local news
  if (/\.(com|co\.uk|org|net)$/.test(d)) return "local";
  return "unknown";
}

const TIER_POINTS: Record<string, number> = { major: 30, national: 20, local: 10, social: 5 };

export function getCorroborationScore(results: ReverseSearchResult[]): {
  score: number;
  label: string;
  color: string;
} {
  let raw = 0;
  for (const r of results) {
    const tier = getOutletTier(r.result_domain);
    raw += TIER_POINTS[tier] || 0;
  }
  const score = Math.min(100, raw);
  if (score >= 70) return { score, label: "Strong", color: "green" };
  if (score >= 40) return { score, label: "Moderate", color: "amber" };
  if (score >= 10) return { score, label: "Weak", color: "red" };
  return { score: 0, label: "None", color: "red" };
}

export function getCorroborationBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

/**
 * Map verdict to a 1–5 rating value for ClaimReview schema.
 */
export function verdictToRating(verdict: import("@/types/investigations").InvestigationVerdict): number {
  const map = { confirmed_fake: 1, likely_fake: 2, inconclusive: 3, likely_real: 4, confirmed_real: 5 };
  return map[verdict];
}
