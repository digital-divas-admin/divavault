"use client";

import { AlertTriangle } from "lucide-react";
import { SectionHeader } from "./section-header";

interface FunnelStep {
  step: string;
  value: number;
  percentage: number;
}

interface FunnelTabProps {
  data: FunnelStep[];
}

export function FunnelTab({ data }: FunnelTabProps) {
  // Find biggest drop-off
  let biggestDrop = { from: "", to: "", drop: 0 };
  for (let i = 1; i < data.length; i++) {
    const drop = data[i - 1].percentage - data[i].percentage;
    if (drop > biggestDrop.drop) {
      biggestDrop = {
        from: data[i - 1].step,
        to: data[i].step,
        drop: Math.round(drop * 10) / 10,
      };
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        label="Funnel"
        title="Enrollment Funnel"
        description="Conversion rates through the signup flow"
      />

      {/* TODO: All funnel data is mock — requires analytics event tracking */}
      <div className="bg-card rounded-xl border border-border/30 p-6">
        <div className="space-y-4">
          {data.map((step, i) => {
            const dropFromPrev =
              i > 0
                ? Math.round(
                    (data[i - 1].percentage - step.percentage) * 10
                  ) / 10
                : 0;

            return (
              <div key={step.step} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground w-4">
                      {i + 1}
                    </span>
                    <span className="font-medium">{step.step}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {step.value.toLocaleString()}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-xs w-12 text-right">
                      {step.percentage}%
                    </span>
                    {dropFromPrev > 0 && (
                      <span className="text-xs text-destructive w-14 text-right">
                        -{dropFromPrev}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-muted/50 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${step.percentage}%`,
                      backgroundColor:
                        i === 0
                          ? "#DC2626"
                          : i === data.length - 1
                            ? "#22C55E"
                            : "#3B82F6",
                      opacity: 0.8 - i * 0.08,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-insight */}
      {biggestDrop.drop > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Biggest drop-off detected</p>
            <p className="text-sm text-muted-foreground mt-1">
              {biggestDrop.drop}% of users drop between{" "}
              <span className="font-medium text-foreground">
                {biggestDrop.from}
              </span>{" "}
              and{" "}
              <span className="font-medium text-foreground">
                {biggestDrop.to}
              </span>
              . Consider simplifying this step or adding more guidance.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground italic">
        All funnel data is simulated. TODO: Instrument analytics events for each
        enrollment step.
      </p>
    </div>
  );
}
