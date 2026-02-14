"use client";

import { useState } from "react";
import { Check, AlertTriangle, Scale, Shield } from "lucide-react";
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

export function CheckProtection() {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const sortedStates = [...statesData].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const state = selectedState ? statesByAbbreviation[selectedState] : null;

  return (
    <div className="space-y-6">
      <Select
        value={selectedState ?? undefined}
        onValueChange={(value) => setSelectedState(value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select your state..." />
        </SelectTrigger>
        <SelectContent>
          {sortedStates.map((s) => (
            <SelectItem key={s.abbreviation} value={s.abbreviation}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!state ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="size-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground text-lg">
              Select your state above to see your AI likeness protection status
            </p>
          </CardContent>
        </Card>
      ) : (
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
                        <Badge variant="purple">{law.year}</Badge>
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
      )}
    </div>
  );
}
