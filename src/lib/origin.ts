export function resolveOrigin(requestOrigin: string | null | undefined): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl;

  const isDev = requestOrigin && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.)/.test(requestOrigin);
  if (isDev) return requestOrigin;

  if (process.env.NODE_ENV !== "development") {
    console.warn("[origin] NEXT_PUBLIC_SITE_URL is not set in non-dev environment");
  }
  return null;
}
