"use client";

import { useEffect, useRef, useState } from "react";
import { extractTweetId } from "@/lib/investigation-utils";
import { ExternalLink } from "lucide-react";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => Promise<void>;
      };
    };
  }
}

interface TwitterEmbedProps {
  tweetUrl: string;
}

export function TwitterEmbed({ tweetUrl }: TwitterEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const tweetId = extractTweetId(tweetUrl);

  useEffect(() => {
    if (!tweetId || !containerRef.current) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setFailed(true);
      }
    }, 5000);

    function loadWidget() {
      if (window.twttr?.widgets && containerRef.current) {
        window.twttr.widgets
          .load(containerRef.current)
          .then(() => {
            if (cancelled) return;
            clearTimeout(timeoutId);
            setLoading(false);
          })
          .catch(() => {
            if (cancelled) return;
            clearTimeout(timeoutId);
            setLoading(false);
            setFailed(true);
          });
      }
    }

    // Inject Twitter widgets.js if not already present
    if (!document.querySelector('script[src*="platform.twitter.com/widgets.js"]')) {
      const script = document.createElement("script");
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.charset = "utf-8";
      script.onload = loadWidget;
      script.onerror = () => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setLoading(false);
        setFailed(true);
      };
      document.head.appendChild(script);
    } else {
      // Script already loaded — just trigger widget rendering
      loadWidget();
    }

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [tweetId]);

  if (!tweetId) {
    return (
      <FallbackLink url={tweetUrl} />
    );
  }

  if (failed) {
    return <FallbackLink url={tweetUrl} />;
  }

  return (
    <div ref={containerRef} className="min-h-[200px]">
      {loading && (
        <div className="animate-pulse space-y-3 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
          </div>
          <div className="h-48 w-full rounded bg-muted" />
        </div>
      )}
      <blockquote className="twitter-tweet" data-theme="dark">
        <a href={tweetUrl}>{tweetUrl}</a>
      </blockquote>
    </div>
  );
}

function FallbackLink({ url }: { url: string }) {
  return (
    <div className="flex items-center justify-center p-8 bg-black/30">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
      >
        <ExternalLink className="w-4 h-4" />
        View on X
      </a>
    </div>
  );
}
