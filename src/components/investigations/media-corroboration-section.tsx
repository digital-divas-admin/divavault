import { Shield, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReverseSearchResult } from "@/types/investigations";
import {
  getOutletTier,
  getCorroborationScore,
  getCorroborationBarColor,
  OUTLET_TIER_STYLES,
  type OutletTier,
} from "@/lib/investigation-utils";

const TIER_ORDER: OutletTier[] = ["major", "national", "local", "social", "unknown"];
const TIER_GROUP_LABELS: Record<OutletTier, string> = {
  major: "Major Outlets",
  national: "National Outlets",
  local: "Local / Regional",
  social: "Social Media",
  unknown: "Other",
};

export function MediaCorroborationSection({
  results,
}: {
  results: ReverseSearchResult[];
}) {
  if (results.length === 0) return null;

  const corroboration = getCorroborationScore(results);

  // Group by tier
  const groups = new Map<OutletTier, ReverseSearchResult[]>();
  for (const r of results) {
    const tier = getOutletTier(r.result_domain);
    if (!groups.has(tier)) groups.set(tier, []);
    groups.get(tier)!.push(r);
  }

  return (
    <section id="media-corroboration">
      <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-6 flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        Media Corroboration
      </h2>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Score bar */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Corroboration Score</span>
            <span className="text-lg font-bold text-foreground">
              {corroboration.score}/100 &mdash;{" "}
              <span
                className={
                  corroboration.color === "green"
                    ? "text-green-500"
                    : corroboration.color === "amber"
                      ? "text-amber-500"
                      : "text-red-500"
                }
              >
                {corroboration.label}
              </span>
            </span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getCorroborationBarColor(corroboration.score)}`}
              style={{ width: `${corroboration.score}%` }}
            />
          </div>
        </div>

        {/* Grouped outlet cards */}
        <div className="p-6 space-y-6">
          {TIER_ORDER.filter((tier) => groups.has(tier)).map((tier) => {
            const style = OUTLET_TIER_STYLES[tier];
            return (
              <div key={tier}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {TIER_GROUP_LABELS[tier]}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groups.get(tier)!.map((r) => (
                    <a
                      key={r.id}
                      href={r.result_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary truncate">
                          {r.result_title || r.result_domain || "Source"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {r.result_domain && (
                            <span className="text-xs text-muted-foreground">{r.result_domain}</span>
                          )}
                          {r.result_date && (
                            <span className="text-xs text-muted-foreground">{r.result_date}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={style.className}>
                        {style.label}
                      </Badge>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Explainer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Media corroboration measures how widely this content has been used by established
            news organizations. Higher scores indicate greater likelihood of authenticity.
          </p>
        </div>
      </div>
    </section>
  );
}
