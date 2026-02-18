"use client";

import type { HoneypotItem } from "@/lib/scanner-command-queries";
import { Card, CardContent } from "@/components/ui/card";
import { HoneypotTable } from "./honeypot-table";
import {
  Users,
  FlaskConical,
  Sparkles,
  Target,
  ArrowRight,
} from "lucide-react";

interface TestUsersTabProps {
  testUserSummary: { seeded: number; honeypot: number; synthetic: number };
  honeypotItems: HoneypotItem[];
}

const SCALE_PHASES = [
  {
    phase: 1,
    label: "Seed",
    description: "Manual test contributors with known embeddings",
    color: "bg-blue-500",
  },
  {
    phase: 2,
    label: "Honeypot",
    description: "Planted content across platforms for detection validation",
    color: "bg-purple-500",
  },
  {
    phase: 3,
    label: "Synthetic",
    description: "AI-generated test faces to scale coverage testing",
    color: "bg-indigo-500",
  },
  {
    phase: 4,
    label: "Production",
    description: "Full-scale monitoring with real contributor base",
    color: "bg-green-500",
  },
];

export function TestUsersTab({
  testUserSummary,
  honeypotItems,
}: TestUsersTabProps) {
  const detectedCount = honeypotItems.filter((h) => h.detected === true).length;
  const totalPlanted = honeypotItems.filter((h) => h.detected !== null).length;
  const detectionRate =
    totalPlanted > 0 ? ((detectedCount / totalPlanted) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium">Seeded Contributors</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {testUserSummary.seeded}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Test accounts with known face embeddings
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-purple-500/10">
                <FlaskConical className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-sm font-medium">Honeypot Contributors</span>
            </div>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
                {testUserSummary.honeypot}
              </p>
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-green-400" />
                <span className="text-sm font-[family-name:var(--font-mono)] text-green-400">
                  {detectionRate}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  detection rate
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {detectedCount} detected / {totalPlanted} planted
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-indigo-500/10">
                <Sparkles className="h-4 w-4 text-indigo-400" />
              </div>
              <span className="text-sm font-medium">Synthetic</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {testUserSummary.synthetic}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              AI-generated test faces for scale testing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Honeypot detection table */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Honeypot Detection Results
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <HoneypotTable items={honeypotItems} />
          </CardContent>
        </Card>
      </div>

      {/* Scale transition plan */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Scale Transition Plan
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {SCALE_PHASES.map((phase, i) => (
                <div key={phase.phase} className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className={`w-6 h-6 rounded-full ${phase.color} flex items-center justify-center text-[10px] font-bold text-white`}
                      >
                        {phase.phase}
                      </div>
                      <span className="text-sm font-medium">{phase.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {phase.description}
                    </p>
                  </div>
                  {i < SCALE_PHASES.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
