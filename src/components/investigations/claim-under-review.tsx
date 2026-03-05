import { ExternalLink, Calendar } from "lucide-react";
import { detectPlatform } from "@/lib/investigation-utils";

interface ClaimUnderReviewProps {
  sourceUrls: string[];
  description: string | null;
  dateFirstSeen: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function getPlatformLabel(platform: string | null): string {
  const labels: Record<string, string> = {
    youtube: "YouTube",
    x: "X (Twitter)",
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    reddit: "Reddit",
    telegram: "Telegram",
    rumble: "Rumble",
  };
  return platform ? labels[platform] || platform : "External";
}

export function ClaimUnderReview({ sourceUrls, description, dateFirstSeen }: ClaimUnderReviewProps) {
  if (!description && sourceUrls.length === 0) return null;

  const firstUrl = sourceUrls[0];
  const platform = firstUrl ? detectPlatform(firstUrl) : null;
  let domain: string | null = null;
  try {
    if (firstUrl) domain = new URL(firstUrl).hostname;
  } catch { /* ignore */ }

  return (
    <section className="bg-card border border-border rounded-xl p-6 sm:p-8">
      <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-4">
        Claim Under Review
      </h2>

      {description && (
        <p className="text-base italic text-foreground/90 mb-4 leading-relaxed">
          &ldquo;{description}&rdquo;
        </p>
      )}

      {firstUrl && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">
            {getPlatformLabel(platform)}
          </span>
          {domain && (
            <>
              <span className="text-muted-foreground/50">&middot;</span>
              <span>{domain}</span>
            </>
          )}
          <a
            href={firstUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline ml-1"
          >
            <ExternalLink className="w-3 h-3" />
            View source
          </a>
        </div>
      )}

      {dateFirstSeen && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          First observed: {dateFormatter.format(new Date(dateFirstSeen))}
        </div>
      )}
    </section>
  );
}
