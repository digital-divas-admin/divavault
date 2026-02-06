"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const steps = [
  { label: "Choose Track" },
  { label: "Verify ID" },
  { label: "Add Photos" },
  { label: "Review & Agree" },
];

interface ProgressBarProps {
  currentStep: number;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full max-w-lg mx-auto mb-8 sm:mb-10">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                    isCompleted && "bg-neon text-background",
                    isCurrent &&
                      "bg-neon/20 text-neon border-2 border-neon neon-glow",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={cn(
                    "hidden sm:block text-xs mt-2 font-medium",
                    isCurrent ? "text-neon" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-2 mb-0 sm:mx-3 sm:mb-6",
                    isCompleted ? "bg-neon" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
