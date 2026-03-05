import { extractTweetId } from "@/lib/investigation-utils";

function getTweetToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

export interface EngagementStats {
  views: number | null;
  reposts: number | null;
  likes: number | null;
  replies: number | null;
  bookmarks: number | null;
  captured_at: string;
}

/**
 * Fetch engagement stats for a tweet using Twitter's syndication API.
 * No API key required. Best-effort — returns null if the API doesn't
 * have data for the tweet (deleted, restricted, etc.).
 */
export async function fetchTweetEngagement(
  sourceUrl: string
): Promise<EngagementStats | null> {
  const tweetId = extractTweetId(sourceUrl);
  if (!tweetId) return null;

  try {
    const token = getTweetToken(tweetId);
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();

    // Empty response means the API has no data for this tweet
    if (!data || Object.keys(data).length === 0) return null;
    // Need at least one stat to be worth saving
    if (!data.favorite_count && !data.conversation_count && !data.views_count) {
      return null;
    }

    // Views can come from multiple places in the response
    let views: number | null = null;
    if (data.views_count) {
      views = typeof data.views_count === "string"
        ? parseInt(data.views_count, 10)
        : data.views_count;
    } else if (data.mediaDetails?.[0]?.viewCount) {
      views = data.mediaDetails[0].viewCount;
    }

    return {
      views,
      reposts:
        (data.retweet_count ?? 0) + (data.quote_count ?? 0) || null,
      likes: data.favorite_count ?? null,
      // Syndication API uses "conversation_count" instead of "reply_count"
      replies: data.conversation_count ?? data.reply_count ?? null,
      bookmarks: null,
      captured_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
