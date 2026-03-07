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

function getEvidenceExplainer(item: InvestigationEvidence): string | null {
  const title = (item.title || "").toLowerCase();

  if (title.includes("ela")) return "Error Level Analysis reveals areas with different compression levels, which can indicate edits";
  if (title.includes("edge detect")) return "Edge detection highlights boundary inconsistencies common in composited images";
  if (title.includes("sharpen")) return "Sharpening reveals hidden detail that may expose manipulation artifacts";
  if (title.includes("color amplify")) return "Color amplification exposes subtle color inconsistencies between original and edited regions";
  if (title.includes("histogram")) return "Histogram equalization reveals hidden tonal patterns that differ between original and manipulated areas";
  if (title.includes("denoise")) return "Noise removal reveals underlying structure that may differ between authentic and generated content";
  if (title.includes("annotated")) return "Areas of interest highlighted by the investigating analyst";

  if (item.evidence_type === "ai_detection") return "Automated analysis to determine if this content was AI-generated";
  if (item.evidence_type === "metadata_anomaly") return "Inconsistency found in the file's technical metadata";
  if (item.evidence_type === "provenance_check") return "Verification of the content's origin and authenticity chain";
  if (item.evidence_type === "source_match") return "This content was found to match existing material in known databases";

  return null;
}

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
        {evidence.map((item, index) => {
          const Icon = EVIDENCE_ICONS[item.evidence_type] || FileText;
          const explainer = getEvidenceExplainer(item);

          return (
            <div key={item.id} id={`exhibit-${index + 1}`} className="relative pl-11">
              {/* Node */}
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                <Icon className="w-2.5 h-2.5 text-primary" />
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Exhibit {index + 1}
                  </span>
                  <Badge variant="outline" className="text-[11px]">
                    {EVIDENCE_TYPE_LABELS[item.evidence_type]}
                  </Badge>
                  <time dateTime={item.created_at} className="text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(item.created_at))}
                  </time>
                </div>

                {item.title && (
                  <h4 className="font-semibold text-foreground text-sm mb-1">
                    {item.title}
                  </h4>
                )}

                {explainer && (
                  <p className="text-xs text-muted-foreground italic mb-1">{explainer}</p>
                )}

                {item.content && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {item.content}
                  </p>
                )}

                {item.attachment_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.attachment_url}
                    alt={item.title || "Evidence attachment"}
                    loading="lazy"
                    className="w-full max-h-80 object-contain bg-black/50 rounded-lg mt-3"
                  />
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
