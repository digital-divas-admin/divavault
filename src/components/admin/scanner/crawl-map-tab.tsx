"use client";

import { useState, useMemo } from "react";
import type {
  SectionProfile,
  PlatformInfo,
} from "@/lib/scanner-command-queries";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTable } from "./section-table";
import {
  Globe,
  AlertTriangle,
  Clock,
  BarChart3,
  Layers,
} from "lucide-react";

interface CrawlMapTabProps {
  sections: SectionProfile[];
  platforms: PlatformInfo[];
  initialPlatform?: string | null;
}

function formatDate(date: string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CrawlMapTab({
  sections,
  platforms,
  initialPlatform,
}: CrawlMapTabProps) {
  const enabledPlatforms = platforms.filter((p) => p.enabled);
  const [selected, setSelected] = useState(
    initialPlatform ||
      (enabledPlatforms.length > 0 ? enabledPlatforms[0].platform : "")
  );

  const platform = platforms.find((p) => p.platform === selected);
  const platformSections = useMemo(
    () => sections.filter((s) => s.platform === selected),
    [sections, selected]
  );

  const highRiskLowCoverage = platformSections.filter((s) => {
    const coverage =
      s.total_content && s.total_scanned
        ? (s.total_scanned / s.total_content) * 100
        : 0;
    return s.ml_risk_level === "high" && coverage < 30;
  });

  const totalContent = platformSections.reduce(
    (sum, s) => sum + (s.total_content || 0),
    0
  );
  const totalScanned = platformSections.reduce(
    (sum, s) => sum + (s.total_scanned || 0),
    0
  );
  const overallCoverage = totalContent > 0
    ? Math.round((totalScanned / totalContent) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Platform selector */}
      <div className="flex items-center gap-1 bg-card rounded-lg border border-border/30 p-1 overflow-x-auto">
        {enabledPlatforms.map((p) => (
          <button
            key={p.platform}
            onClick={() => setSelected(p.platform)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap capitalize ${
              selected === p.platform
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.platform}
          </button>
        ))}
        {enabledPlatforms.length === 0 && (
          <span className="text-xs text-muted-foreground px-3 py-1.5">
            No platforms enabled
          </span>
        )}
      </div>

      {platform && (
        <>
          {/* Platform header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-card border-border/30">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="rounded-full p-1.5 bg-primary/10">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold capitalize">
                    {platform.platform}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {platform.crawl_phase || "idle"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/30">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="rounded-full p-1.5 bg-blue-500/10">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium">
                    {formatDate(platform.last_crawl_at)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Last crawl
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/30">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="rounded-full p-1.5 bg-indigo-500/10">
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold font-[family-name:var(--font-mono)]">
                    {platformSections.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Sections</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/30">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="rounded-full p-1.5 bg-green-500/10">
                  <BarChart3 className="h-3.5 w-3.5 text-green-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold font-[family-name:var(--font-mono)]">
                      {overallCoverage}%
                    </p>
                    <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${overallCoverage}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Coverage</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Blind spots alert */}
          {highRiskLowCoverage.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-400">
                  Blind Spots Detected
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {highRiskLowCoverage.length} high-risk section
                  {highRiskLowCoverage.length !== 1 ? "s" : ""} with less than
                  30% coverage:{" "}
                  {highRiskLowCoverage
                    .map((s) => s.section_name || s.section_key)
                    .join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Section table */}
          <Card className="bg-card border-border/30">
            <CardContent className="p-4">
              <SectionTable sections={platformSections} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
