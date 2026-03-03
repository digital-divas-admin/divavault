import { Badge } from "@/components/ui/badge";
import type { InvestigationDetail } from "@/types/investigations";
import {
  VERDICT_LABELS,
  VERDICT_COLORS,
  CATEGORY_LABELS,
} from "@/types/investigations";
import { MapPin, Calendar } from "lucide-react";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function InvestigationHero({
  investigation,
}: {
  investigation: InvestigationDetail;
}) {
  const publishedDate = investigation.published_at
    ? dateFormatter.format(new Date(investigation.published_at))
    : dateFormatter.format(new Date(investigation.date_investigated));

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
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl text-foreground mb-6 leading-tight">
          {investigation.title}
        </h1>

        {/* Verdict + Confidence */}
        {investigation.verdict && (
          <div className="flex items-center gap-5 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${VERDICT_COLORS[investigation.verdict]}`}
            >
              {VERDICT_LABELS[investigation.verdict]}
            </span>

            {investigation.confidence_score !== null && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground font-medium">
                  Confidence
                </span>
                <div className="w-32 h-2 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${investigation.confidence_score}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {investigation.confidence_score}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
