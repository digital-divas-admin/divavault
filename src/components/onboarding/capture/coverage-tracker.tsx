"use client";

import { CheckCircle2, Circle } from "lucide-react";

interface CoverageTrackerProps {
  capturedSteps: string[];
  currentStepId: string;
}

const GROUPS = [
  {
    label: "Angles",
    steps: [
      { id: "face_front", name: "Front" },
      { id: "face_left", name: "Left" },
      { id: "face_right", name: "Right" },
      { id: "face_up", name: "Up" },
      { id: "face_down", name: "Down" },
    ],
  },
  {
    label: "Expressions",
    steps: [
      { id: "expression_smile", name: "Smile" },
      { id: "expression_neutral", name: "Neutral" },
      { id: "expression_serious", name: "Serious" },
    ],
  },
  {
    label: "Body",
    steps: [
      { id: "upper_body", name: "Upper" },
      { id: "full_body", name: "Full" },
    ],
  },
] as const;

export function CoverageTracker({
  capturedSteps,
  currentStepId,
}: CoverageTrackerProps) {
  return (
    <div className="mb-4 space-y-2">
      {GROUPS.map((group) => {
        const captured = group.steps.filter((s) =>
          capturedSteps.includes(s.id)
        ).length;
        return (
          <div key={group.label}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {group.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {captured}/{group.steps.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.steps.map((step) => {
                const isCaptured = capturedSteps.includes(step.id);
                const isCurrent = step.id === currentStepId;

                if (isCaptured) {
                  return (
                    <span
                      key={step.id}
                      className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {step.name}
                    </span>
                  );
                }

                if (isCurrent) {
                  return (
                    <span
                      key={step.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary animate-pulse"
                    >
                      <Circle className="h-3 w-3" />
                      {step.name}
                    </span>
                  );
                }

                return (
                  <span
                    key={step.id}
                    className="inline-flex items-center gap-1 rounded-full bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    <Circle className="h-3 w-3" />
                    {step.name}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
