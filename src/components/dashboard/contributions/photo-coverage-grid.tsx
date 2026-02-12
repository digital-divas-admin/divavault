"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { PhotoSlot } from "./photo-slot";
import { COVERAGE_GROUPS } from "@/lib/coverage-config";
import { CAPTURE_STEPS } from "@/lib/capture-steps";
import type { CoverageMap, CoverageSlotData } from "@/lib/coverage-queries";
import type { CaptureStepConfig } from "@/types/capture";

interface PhotoCoverageGridProps {
  initialCoverage: CoverageMap;
  initialSection?: string;
}

const stepConfigMap = new Map<string, CaptureStepConfig>(
  CAPTURE_STEPS.map((s) => [s.id, s])
);

export function PhotoCoverageGrid({
  initialCoverage,
  initialSection,
}: PhotoCoverageGridProps) {
  const [coverage, setCoverage] = useState<CoverageMap>(initialCoverage);

  useEffect(() => {
    if (initialSection) {
      const el = document.getElementById(`coverage-${initialSection}`);
      if (el) {
        // Small delay to ensure layout is settled
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [initialSection]);

  const handleUpload = useCallback(
    async (step: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("captureStep", step);

      const res = await fetch("/api/dashboard/coverage-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      const { imageId, signedUrl } = await res.json();

      // Optimistically update coverage map
      setCoverage((prev) => ({
        ...prev,
        [step]: {
          id: imageId,
          captureStep: step,
          signedUrl,
          qualityScore: null,
          createdAt: new Date().toISOString(),
        } satisfies CoverageSlotData,
      }));
    },
    []
  );

  return (
    <div className="space-y-8">
      {COVERAGE_GROUPS.map((group) => {
        const filledCount = group.steps.filter((s) => coverage[s]).length;
        const totalCount = group.steps.length;

        return (
          <section
            key={group.id}
            id={`coverage-${group.id}`}
            className="scroll-mt-24"
          >
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold">
                {group.label}
              </h3>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  filledCount === totalCount
                    ? "border-green-500/30 text-green-500"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {filledCount}/{totalCount}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {group.description}
            </p>
            <div
              className={`grid gap-3 ${
                group.id === "angles"
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
                  : group.id === "expressions"
                    ? "grid-cols-2 sm:grid-cols-3"
                    : "grid-cols-2"
              }`}
            >
              {group.steps.map((step) => {
                const config = stepConfigMap.get(step);
                if (!config) return null;
                return (
                  <PhotoSlot
                    key={step}
                    step={step}
                    stepConfig={config}
                    image={coverage[step]}
                    points={group.pointsPerStep}
                    onUpload={handleUpload}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
