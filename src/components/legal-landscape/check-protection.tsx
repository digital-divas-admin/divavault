"use client";

import { useState, useMemo } from "react";
import { Check, AlertTriangle, Scale, Shield, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProtectionBadge } from "./protection-badge";
import { RiskMeter } from "./risk-meter";
import { GlossaryText } from "./glossary-text";
import { ActionPaths } from "./action-paths";
import { statesData, statesByAbbreviation } from "@/data/legal-landscape/states";
import type { ProtectionLevel } from "@/data/legal-landscape/types";

const LEVEL_COUNTS_ORDER: { level: ProtectionLevel; label: string; color: string }[] = [
  { level: "strong", label: "Strong", color: "text-green-400" },
  { level: "moderate", label: "Moderate", color: "text-amber-400" },
  { level: "basic", label: "Basic", color: "text-blue-400" },
  { level: "none", label: "None", color: "text-red-400" },
];

export function CheckProtection() {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const sortedStates = [...statesData].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const state = selectedState ? statesByAbbreviation[selectedState] : null;

  const levelCounts = useMemo(() => {
    const counts: Record<ProtectionLevel, number> = { strong: 0, moderate: 0, basic: 0, none: 0 };
    for (const s of statesData) counts[s.protectionLevel]++;
    return counts;
  }, []);

  if (!state) {
    return (
      <div className="flex flex-col items-center">
        <Card className="border-border/50 w-full max-w-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <CardContent className="relative flex flex-col items-center text-center py-10 sm:py-14 px-6 sm:px-10">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Shield className="size-8 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-[family-name:var(--font-heading)] text-foreground mb-3">
              How protected are you?
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Find out if your state has laws protecting your likeness from unauthorized AI use.
            </p>

            <div className="w-full max-w-xs">
              <Select
                value={selectedState ?? undefined}
                onValueChange={(value) => setSelectedState(value)}
              >
                <SelectTrigger className="w-full h-12 text-base border-primary/30 hover:border-primary/60 transition-colors">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-primary shrink-0" />
                    <SelectValue placeholder="Choose your state" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {sortedStates.map((s) => (
                    <SelectItem key={s.abbreviation} value={s.abbreviation}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick stats */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 mt-8 pt-6 border-t border-border/50 w-full">
              {LEVEL_COUNTS_ORDER.map(({ level, label, color }) => (
                <div key={level} className="flex flex-col items-center gap-1">
                  <span className={`text-lg sm:text-xl font-bold ${color}`}>{levelCounts[level]}</span>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg sm:text-xl font-bold text-foreground">{statesData.length}</span>
                <span className="text-[11px] text-muted-foreground">Total</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact selector when state is chosen */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedState ?? undefined}
          onValueChange={(value) => setSelectedState(value)}
        >
          <SelectTrigger className="w-auto min-w-[200px]">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary shrink-0" />
              <SelectValue placeholder="Choose your state" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {sortedStates.map((s) => (
              <SelectItem key={s.abbreviation} value={s.abbreviation}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">Change state</span>
      </div>

      {/* State detail */}
      <div className="space-y-6">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-[family-name:var(--font-heading)]">
              {state.name}
            </h2>
            <ProtectionBadge level={state.protectionLevel} />
          </div>

          <RiskMeter level={state.protectionLevel} />

          {/* Summary */}
          <p className="text-muted-foreground leading-relaxed">
            <GlossaryText text={state.summary} />
          </p>

          {/* What's Protected + Coverage Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50 border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Check className="size-4" />
                  What&apos;s Protected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {state.highlights.map((highlight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 border-l-4 border-l-amber-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="size-4" />
                  Coverage Gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {state.gaps.map((gap, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-medium">
                          {gap.area}:
                        </span>{" "}
                        {gap.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Federal Protections */}
          <Card className="border-border/50 border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Scale className="size-4" />
                Federal Protections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Federal protections apply to all states regardless of local
                legislation. The TAKE IT DOWN Act criminalizes non-consensual
                intimate deepfakes nationwide. Additional federal bills like the
                NO FAKES Act and DEFIANCE Act are under consideration and would
                further strengthen protections.
              </p>
            </CardContent>
          </Card>

          {/* Applicable Laws */}
          {state.laws.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold font-[family-name:var(--font-heading)]">Applicable Laws</h3>
              <div className="space-y-3">
                {state.laws.map((law, i) => (
                  <Card key={i} className="border-border/50 card-hover">
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{law.name}</span>
                        <Badge variant="primary">{law.year}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {law.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Action Paths */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold font-[family-name:var(--font-heading)]">What You Can Do</h3>
            <ActionPaths
              protectionLevel={state.protectionLevel}
              stateName={state.name}
            />
          </div>
        </div>
    </div>
  );
}
