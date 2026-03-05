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
  const publishedDate = investigation.published_at
    ? dateFormatter.format(new Date(investigation.published_at))
    : dateFormatter.format(new Date(investigation.date_investigated));

  const url = investigationUrl(investigation.slug);

  return (
    <section className="pt-12 pb-10 px-4 sm:pt-20 sm:pb-14 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-4xl mx-auto relative">
        {/* Category + Date row */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <Badge variant="primary">
            {CATEGORY_LABELS[investigation.category]}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            {publishedDate}
          </span>
          {investigation.geographic_context && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {investigation.geographic_context}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl text-foreground mb-3 leading-tight">
          {investigation.title}
        </h1>

        {/* Description subtitle */}
        {investigation.description && (
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            {investigation.description}
          </p>
        )}

        {/* Verdict badge */}
        {investigation.verdict && (
          <div className="mb-6">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${VERDICT_COLORS[investigation.verdict]}`}
            >
              <span className={`w-2 h-2 rounded-full ${
                investigation.verdict === "confirmed_fake" ? "bg-red-500" :
                investigation.verdict === "likely_fake" ? "bg-orange-500" :
                investigation.verdict === "inconclusive" ? "bg-yellow-500" :
                investigation.verdict === "likely_real" ? "bg-blue-500" :
                "bg-green-500"
              }`} />
              {VERDICT_LABELS[investigation.verdict]}
            </span>
          </div>
        )}

        {/* Metadata bar + Share buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{publishedDate}</span>
            <span className="text-muted-foreground/40">&middot;</span>
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
