import { VERDICT_LABELS } from "@/types/investigations";
import type { InvestigationVerdict } from "@/types/investigations";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

interface VerdictBannerProps {
  verdict: InvestigationVerdict;
  confidenceScore: number | null;
}

const BANNER_STYLES: Record<InvestigationVerdict, { bg: string; border: string; text: string; icon: string }> = {
  confirmed_fake: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-500", icon: "text-red-500" },
  likely_fake: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-500", icon: "text-orange-500" },
  inconclusive: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-500", icon: "text-yellow-500" },
  likely_real: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-500", icon: "text-blue-500" },
  confirmed_real: { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-500", icon: "text-green-500" },
};

function VerdictIcon({ verdict, className }: { verdict: InvestigationVerdict; className?: string }) {
  if (verdict === "confirmed_fake" || verdict === "likely_fake")
    return <ShieldAlert className={className} />;
  if (verdict === "confirmed_real" || verdict === "likely_real")
    return <ShieldCheck className={className} />;
  return <ShieldQuestion className={className} />;
}

export function VerdictBanner({ verdict, confidenceScore }: VerdictBannerProps) {
  const label = VERDICT_LABELS[verdict];
  const styles = BANNER_STYLES[verdict];

  return (
    <div
      className={`w-full border-y ${styles.bg} ${styles.border} no-print`}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-center gap-3">
        <VerdictIcon verdict={verdict} className={`w-6 h-6 sm:w-7 sm:h-7 ${styles.icon}`} />
        <h2 className={`text-xl sm:text-2xl font-[family-name:var(--font-heading)] ${styles.text}`}>
          {label}
        </h2>
        {confidenceScore !== null && (
          <span className="text-base sm:text-lg font-semibold text-muted-foreground">
            &middot; {confidenceScore}%
          </span>
        )}
      </div>
    </div>
  );
}
