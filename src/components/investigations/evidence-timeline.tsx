import {
  FileText,
  StickyNote,
  ExternalLink,
  Image,
  AlertTriangle,
  Clock,
  Search,
  Bot,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvestigationEvidence, EvidenceType } from "@/types/investigations";
import { EVIDENCE_TYPE_LABELS } from "@/types/investigations";

const EVIDENCE_ICONS: Record<EvidenceType, React.ElementType> = {
  finding: FileText,
  note: StickyNote,
  external_link: ExternalLink,
  screenshot: Image,
  metadata_anomaly: AlertTriangle,
  timeline_entry: Clock,
  source_match: Search,
  ai_detection: Bot,
  provenance_check: ShieldCheck,
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function EvidenceTimeline({
  evidence,
}: {
  evidence: InvestigationEvidence[];
}) {
  if (evidence.length === 0) return null;

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-6">
        {evidence.map((item) => {
          const Icon = EVIDENCE_ICONS[item.evidence_type] || FileText;

          return (
            <div key={item.id} className="relative pl-11">
              {/* Node */}
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                <Icon className="w-2.5 h-2.5 text-primary" />
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="text-[11px]">
                    {EVIDENCE_TYPE_LABELS[item.evidence_type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(item.created_at))}
                  </span>
                </div>

                {item.title && (
                  <h4 className="font-semibold text-foreground text-sm mb-1">
                    {item.title}
                  </h4>
                )}

                {item.content && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {item.content}
                  </p>
                )}

                {item.external_url && (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View source
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
