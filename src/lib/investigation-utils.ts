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
