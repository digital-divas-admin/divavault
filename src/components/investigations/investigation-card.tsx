import Link from "next/link";
import { SearchSlash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvestigationListItem } from "@/types/investigations";
import {
  VERDICT_LABELS,
  VERDICT_COLORS,
  CATEGORY_LABELS,
} from "@/types/investigations";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function InvestigationCard({
  investigation,
}: {
  investigation: InvestigationListItem;
}) {
  const publishedDate = investigation.published_at
    ? dateFormatter.format(new Date(investigation.published_at))
    : dateFormatter.format(new Date(investigation.created_at));

  return (
    <Link href={`/investigations/${investigation.slug}`} className="block group">
      <div className="bg-card border border-border rounded-xl overflow-hidden card-hover h-full flex flex-col">
        {/* Thumbnail */}
        <div className="aspect-video bg-muted flex items-center justify-center">
          {investigation.thumbnail_path ? (
            <div className="w-full h-full bg-muted" />
          ) : (
            <SearchSlash className="w-10 h-10 text-muted-foreground/40" />
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="primary"
              className="text-[11px] px-2 py-0.5"
            >
              {CATEGORY_LABELS[investigation.category]}
            </Badge>
            {investigation.verdict && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${VERDICT_COLORS[investigation.verdict]}`}
              >
                {VERDICT_LABELS[investigation.verdict]}
              </span>
            )}
          </div>

          <h3 className="font-semibold text-foreground text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {investigation.title}
          </h3>

          <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
            <span>{publishedDate}</span>
            {investigation.confidence_score !== null && (
              <span className="font-medium">
                {investigation.confidence_score}% confidence
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
