const INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";

export function getInstagramAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    scope: "user_profile,user_media",
    response_type: "code",
    state,
  });

  return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID!,
    client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    code,
  });

  const res = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    throw new Error("Failed to exchange Instagram code for token");
  }

  return res.json() as Promise<{
    access_token: string;
    user_id: number;
  }>;
}

const MAX_MEDIA_FETCH = 200;
const PAGE_SIZE = 50;

export async function fetchUserMedia(
  accessToken: string,
  maxItems = MAX_MEDIA_FETCH
): Promise<InstagramMedia[]> {
  const allMedia: InstagramMedia[] = [];
  const firstUrl = `${INSTAGRAM_GRAPH_URL}/me/media?${new URLSearchParams({
    fields: "id,media_url,media_type,thumbnail_url,timestamp",
    access_token: accessToken,
    limit: PAGE_SIZE.toString(),
  })}`;

  let nextUrl: string | null = firstUrl;

  while (nextUrl && allMedia.length < maxItems) {
    const res: Response = await fetch(nextUrl);

    if (!res.ok) {
      throw new Error("Failed to fetch Instagram media");
    }

    const data = await res.json();
    const images = (data.data as InstagramMedia[]).filter(
      (m: InstagramMedia) => m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM"
    );

    allMedia.push(...images);

    // Follow pagination cursor if more pages exist and we haven't hit the cap
    const cursor: string | undefined = data.paging?.next;
    nextUrl = allMedia.length < maxItems && cursor ? cursor : null;
  }

  return allMedia.slice(0, maxItems);
}

export interface InstagramMedia {
  id: string;
  media_url: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  thumbnail_url?: string;
  timestamp: string;
}
