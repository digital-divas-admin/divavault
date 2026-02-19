"use client";

import { useState, useMemo } from "react";
import type {
  SectionProfile,
  PlatformInfo,
  AnomalyAlert,
  CrossPlatformRisk,
} from "@/lib/scanner-command-queries";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTable } from "./section-table";
import {
  Globe,
  AlertTriangle,
  Clock,
  ScanSearch,
  Layers,
  Brain,
  Tag,
} from "lucide-react";

interface CrawlMapTabProps {
  sections: SectionProfile[];
  platforms: PlatformInfo[];
  initialPlatform?: string | null;
  anomalyAlerts?: AnomalyAlert[];
  crossPlatformRisks?: CrossPlatformRisk[];
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
  anomalyAlerts,
  crossPlatformRisks,
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

  const enabledCount = platformSections.filter((s) => s.scan_enabled).length;
  const totalScanned = platformSections.reduce(
    (sum, s) => sum + (s.total_scanned || 0),
    0
  );
  const totalFaces = platformSections.reduce(
    (sum, s) => sum + (s.total_faces || 0),
    0
  );
  const avgFaceRate = totalScanned > 0
    ? totalFaces / totalScanned
    : 0;
  const uniqueTagCount = new Set(
    platformSections
      .filter((s) => s.scan_enabled)
      .flatMap((s) => s.tags ?? [])
  ).size;

  // Blind spots: enabled sections that haven't been scanned yet
  const unscannedEnabled = platformSections.filter(
    (s) => s.scan_enabled && (!s.total_scanned || s.total_scanned === 0)
  );
  // High-risk sections that aren't enabled
  const highRiskDisabled = platformSections.filter(
    (s) =>
      !s.scan_enabled &&
      (s.ml_risk_level === "critical" || s.ml_risk_level === "high")
  );

  // Recently discovered sections (created in last 7 days and not yet enabled)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const newSections = platformSections.filter(
    (s) => s.last_updated_at > sevenDaysAgo && !s.scan_enabled
  );

  return (
    <div className="space-y-6">
      {/* Anomaly Alert Banner */}
      {anomalyAlerts && anomalyAlerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {anomalyAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                alert.risk_level === "high"
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-yellow-500/30 bg-yellow-500/10"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  alert.risk_level === "high" ? "text-red-400" : "text-yellow-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100">
                  {alert.target_platform && (
                    <span className="text-zinc-400">[{alert.target_platform}] </span>
                  )}
                  {alert.target_entity}
                </p>
                <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
                  {alert.reasoning}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700">
                  Dismiss
                </button>
                <button className="rounded-md bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-500">
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                <div className="rounded-full p-1.5 bg-indigo-500/10">
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold font-[family-name:var(--font-mono)]">
                    {enabledCount}
                    <span className="text-muted-foreground font-normal text-xs">
                      {" "}/ {platformSections.length}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Sections enabled
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/30">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="rounded-full p-1.5 bg-orange-500/10">
                  <Tag className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-bold font-[family-name:var(--font-mono)]">
                    {uniqueTagCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Active tags
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/30">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="rounded-full p-1.5 bg-blue-500/10">
                  <ScanSearch className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold font-[family-name:var(--font-mono)]">
                    {totalScanned.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Images scanned
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/30">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="rounded-full p-1.5 bg-green-500/10">
                  <Brain className="h-3.5 w-3.5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold font-[family-name:var(--font-mono)]">
                    {avgFaceRate > 0
                      ? `${(avgFaceRate * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Avg face rate
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Discovery Feed */}
          {newSections.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                <ScanSearch className="h-4 w-4" />
                Recently Discovered ({newSections.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {newSections.slice(0, 6).map((section) => (
                  <div
                    key={section.section_key}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {section.section_name || section.section_key}
                      </span>
                      <span className="ml-2 shrink-0 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-300">
                        NEW
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                      {section.total_content != null && (
                        <span>{section.total_content.toLocaleString()} items</span>
                      )}
                      {section.face_rate != null && section.face_rate > 0 && (
                        <span className={section.face_rate > 0.5 ? "text-red-400" : "text-zinc-400"}>
                          {(section.face_rate * 100).toFixed(0)}% faces
                        </span>
                      )}
                    </div>
                    {section.tags && section.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {section.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blind spots alerts */}
          {highRiskDisabled.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  High-Risk Sections Disabled
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {highRiskDisabled.length} high-risk section
                  {highRiskDisabled.length !== 1 ? "s are" : " is"} not being
                  scanned:{" "}
                  {highRiskDisabled
                    .slice(0, 5)
                    .map((s) => s.section_name || s.section_key)
                    .join(", ")}
                  {highRiskDisabled.length > 5 &&
                    ` +${highRiskDisabled.length - 5} more`}
                </p>
              </div>
            </div>
          )}
          {unscannedEnabled.length > 0 && totalScanned > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
              <Clock className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-400">
                  Awaiting First Scan
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {unscannedEnabled.length} enabled section
                  {unscannedEnabled.length !== 1 ? "s haven't" : " hasn't"} been
                  scanned yet
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

          {/* Cross-Platform Risk */}
          {crossPlatformRisks && crossPlatformRisks.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Cross-Platform Risk Terms
              </h3>
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Tag</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Platforms</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">Max Face Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossPlatformRisks.slice(0, 15).map((risk) => {
                      const maxFaceRate = Math.max(...risk.platforms.map((p) => p.face_rate));
                      return (
                        <tr key={risk.tag} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="px-4 py-2 font-mono text-xs text-zinc-200">{risk.tag}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1.5 flex-wrap">
                              {risk.platforms.map((p) => (
                                <span
                                  key={p.platform}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                                    p.scan_enabled
                                      ? p.risk_level === "high"
                                        ? "bg-red-500/20 text-red-300"
                                        : "bg-green-500/20 text-green-300"
                                      : "bg-zinc-800 text-zinc-500"
                                  }`}
                                >
                                  {p.platform}
                                  {!p.scan_enabled && " (not scanned)"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={`text-xs ${maxFaceRate > 0.5 ? "text-red-400 font-medium" : "text-zinc-400"}`}>
                              {(maxFaceRate * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
