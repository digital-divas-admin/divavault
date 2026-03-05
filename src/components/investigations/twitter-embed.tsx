"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { extractTweetId } from "@/lib/investigation-utils";
import { ExternalLink } from "lucide-react";

interface TwitterEmbedProps {
  tweetUrl: string;
}

export function TwitterEmbed({ tweetUrl }: TwitterEmbedProps) {
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(300);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tweetId = extractTweetId(tweetUrl);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Twitter embed sends resize messages via postMessage
      if (
        event.origin === "https://platform.twitter.com" &&
        typeof event.data === "object" &&
        event.data
      ) {
        const data = event.data as Record<string, unknown>;
        // Twitter sends {"twttr.embed": { method: "twttr.private.resize", params: [{ height }] }}
        const embed = data["twttr.embed"] as
          | { method?: string; params?: Array<{ height?: number }> }
          | undefined;
        if (embed?.method === "twttr.private.resize" && embed.params?.[0]?.height) {
          setHeight(embed.params[0].height);
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  if (!tweetId || failed) {
    return <FallbackLink url={tweetUrl} />;
  }

  return (
    <div className="flex justify-center">
      <iframe
        ref={iframeRef}
        src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark`}
        className="w-full max-w-[550px] border-0 transition-[height] duration-200"
        style={{ height: `${height}px` }}
        allowFullScreen
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onError={() => setFailed(true)}
        title="Tweet embed"
      />
    </div>
  );
}

function FallbackLink({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 bg-black/40 border border-border rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span className="text-sm font-medium text-foreground">Post on X</span>
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-sm">
        This post could not be embedded. It may have been deleted or is unavailable.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View on X
      </a>
    </div>
  );
}
