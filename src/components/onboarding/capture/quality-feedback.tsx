"use client";

import type { QualityCheckResult } from "@/types/capture";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualityFeedbackProps {
  checks: QualityCheckResult[];
}

export function QualityFeedback({ checks }: QualityFeedbackProps) {
  if (checks.length === 0) return null;

  const failedChecks = checks.filter((c) => !c.passed);
  const allPassed = failedChecks.length === 0;

  return (
    <div
      className={cn(
        "absolute top-4 left-4 right-4 px-4 py-3 rounded-xl backdrop-blur-md text-sm",
        allPassed
          ? "bg-green-500/80 text-white"
          : "bg-black/70 text-white"
      )}
    >
      {allPassed ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Ready! Tap to capture.</span>
        </div>
      ) : (
        <div className="space-y-1">
          {failedChecks.map((check) => (
            <div key={check.type} className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs">{check.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
