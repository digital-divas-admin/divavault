"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectionBadge } from "./protection-badge";
import { RiskMeter } from "./risk-meter";
import { GlossaryText } from "./glossary-text";
import { statesByAbbreviation } from "@/data/legal-landscape/states";

const USMapChart = dynamic(() => import("./us-map-chart"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full bg-zinc-800/50 animate-pulse rounded-xl" />
  ),
});

export function StateMap() {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const state = selectedState ? statesByAbbreviation[selectedState] : null;

  return (
    <div className="space-y-6">
      <USMapChart
        onStateSelect={setSelectedState}
        selectedState={selectedState}
      />

      {state && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-xl font-[family-name:var(--font-heading)]">
                {state.name}
              </CardTitle>
              <ProtectionBadge level={state.protectionLevel} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <RiskMeter level={state.protectionLevel} />
            <p className="text-sm text-muted-foreground leading-relaxed">
              <GlossaryText text={state.summary} />
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
