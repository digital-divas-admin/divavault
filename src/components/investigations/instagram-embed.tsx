"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}

interface InstagramEmbedProps {
  url: string;
}

export function InstagramEmbed({ url }: InstagramEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setFailed(true);
      }
    }, 5000);

    function processEmbed() {
      if (window.instgrm?.Embeds) {
        window.instgrm.Embeds.process();
        if (!cancelled) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    }

    if (!document.querySelector('script[src*="instagram.com/embed.js"]')) {
      const script = document.createElement("script");
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      script.onload = processEmbed;
      script.onerror = () => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setLoading(false);
        setFailed(true);
      };
      document.head.appendChild(script);
    } else {
      processEmbed();
    }

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [url]);

  if (failed) {
    return <FallbackLink url={url} />;
  }

  return (
    <div ref={containerRef} className="min-h-[200px]">
      {loading && (
        <div className="animate-pulse space-y-3 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="h-3.5 w-28 rounded bg-muted" />
          </div>
          <div className="h-64 w-full rounded bg-muted" />
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
      )}
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ margin: "0 auto", maxWidth: "540px", width: "100%" }}
      >
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}

function FallbackLink({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 bg-black/40 border border-border rounded-lg">
      <span className="text-sm font-medium text-foreground">Post on Instagram</span>
      <p className="text-xs text-muted-foreground text-center max-w-sm">
        This post could not be embedded. It may be private or unavailable.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View on Instagram
      </a>
    </div>
  );
}
