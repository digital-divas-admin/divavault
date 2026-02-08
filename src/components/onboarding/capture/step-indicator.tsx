"use client";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentIndex: number;
  totalSteps: number;
  label: string;
  instruction: string;
}

export function StepIndicator({
  currentIndex,
  totalSteps,
  label,
  instruction,
}: StepIndicatorProps) {
  return (
    <div className="text-center mb-4">
      <div className="flex items-center justify-center gap-1.5 mb-3">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              i < currentIndex
                ? "bg-primary"
                : i === currentIndex
                ? "bg-primary w-6"
                : "bg-border"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-1">
        Photo {currentIndex + 1} of {totalSteps}
      </p>
      <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold">
        {label}
      </h3>
      <p className="text-sm text-muted-foreground">{instruction}</p>
    </div>
  );
}
