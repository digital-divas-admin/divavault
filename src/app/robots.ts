import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/onboarding", "/api"],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/onboarding", "/api"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/onboarding", "/api"],
      },
      {
        userAgent: "Claude-Web",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/onboarding", "/api"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/onboarding", "/api"],
      },
    ],
    sitemap: "https://www.consentedai.com/sitemap.xml",
  };
}
