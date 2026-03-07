import { Badge } from "@/components/ui/badge";
import type { InvestigationDetail } from "@/types/investigations";
import {
  VERDICT_LABELS,
  VERDICT_COLORS,
  CATEGORY_LABELS,
} from "@/types/investigations";
import { investigationUrl } from "@/lib/investigation-utils";
import { MapPin, Calendar } from "lucide-react";
import { ShareButtons } from "@/components/investigations/share-buttons";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function InvestigationHero({
  investigation,
  readTime,
}: {
  investigation: InvestigationDetail;
  readTime: number;
}) {
  const dateIso = investigation.published_at || investigation.date_investigated;
  const publishedDate = dateFormatter.format(new Date(dateIso));

  const url = investigationUrl(investigation.slug);

  return (
    <section className="pt-10 pb-6 px-4 sm:pt-14 sm:pb-8 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-4xl mx-auto relative">
        {/* Category + Date + Region */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Badge variant="primary">
            {CATEGORY_LABELS[investigation.category]}
          </Badge>
          <time dateTime={dateIso} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            {publishedDate}
          </time>
          {investigation.geographic_context && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {investigation.geographic_context}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl md:text-4xl text-foreground mb-3 leading-tight">
          {investigation.title}
        </h1>

        {/* Metadata bar + Share buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{readTime} min read</span>
            <span className="text-muted-foreground/40">&middot;</span>
            <span>Consented AI Forensic Team</span>
          </div>
          <ShareButtons url={url} title={investigation.title} />
        </div>
      </div>
    </section>
  );
}
