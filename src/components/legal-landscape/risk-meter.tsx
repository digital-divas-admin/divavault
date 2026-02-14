"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProtectionLevel } from "@/data/legal-landscape/types";

const config: Record<
  ProtectionLevel,
  { filled: number; label: string; color: string }
> = {
  strong: { filled: 5, label: "Severe Risk for Violators", color: "#22C55E" },
  moderate: { filled: 3, label: "Significant Risk", color: "#F59E0B" },
  basic: { filled: 2, label: "Moderate Risk", color: "#3B82F6" },
  none: { filled: 1, label: "Low Risk", color: "#52525B" },
};

const TOTAL_SEGMENTS = 5;

export function RiskMeter({
  level,
  className,
}: {
  level: ProtectionLevel;
  className?: string;
}) {
  const { filled, label, color } = config[level];
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="meter"
        aria-label={`Risk level: ${label}`}
        aria-valuemin={0}
        aria-valuemax={TOTAL_SEGMENTS}
        aria-valuenow={filled}
        aria-valuetext={label}
        className="flex gap-1"
      >
        {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => {
          const isFilled = i < filled;
          const opacity = isFilled
            ? 1 - ((i / (filled - 1 || 1)) * 0.5)
            : undefined;

          return (
            <div
              key={i}
              className={cn(
                "h-3 w-full rounded",
                !isFilled && "bg-secondary",
                !prefersReducedMotion &&
                  "transition-all duration-500 ease-out"
              )}
              style={
                isFilled
                  ? { backgroundColor: color, opacity }
                  : undefined
              }
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
