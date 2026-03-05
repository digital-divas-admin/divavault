import type { InvestigationVerdict } from "@/types/investigations";
import { VERDICT_LABELS, VERDICT_COLORS, VERDICT_TEXT_COLORS } from "@/types/investigations";

interface ConfidenceScoreDisplayProps {
  score: number;
  verdict: InvestigationVerdict;
  evidenceCount: number;
}

export function ConfidenceScoreDisplay({ score, verdict, evidenceCount }: ConfidenceScoreDisplayProps) {
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference * (1 - score / 100);

  return (
    <section className="bg-card border border-border rounded-xl p-8 sm:p-12">
      <div className="flex flex-col items-center text-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="mb-4"
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className={`${VERDICT_TEXT_COLORS[verdict]} score-ring-progress`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              "--ring-circumference": circumference,
              "--ring-target": target,
            } as React.CSSProperties}
          />
          {/* Score text */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground font-[family-name:var(--font-mono)] text-[40px] font-bold score-number"
          >
            {score}
          </text>
        </svg>

        <span
          className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold mb-3 ${VERDICT_COLORS[verdict]}`}
        >
          {VERDICT_LABELS[verdict]}
        </span>

        <p className="text-sm text-muted-foreground">
          Based on {evidenceCount} piece{evidenceCount !== 1 ? "s" : ""} of evidence analyzed
        </p>
      </div>
    </section>
  );
}
