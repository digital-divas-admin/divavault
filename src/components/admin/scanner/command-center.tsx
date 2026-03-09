"use client";

import { useState, useEffect } from "react";
import type { CommandCenterData } from "@/lib/scanner-command-queries";
import { ScanLineHeader } from "./scan-line-header";
import { HealthPulseBar } from "./health-pulse-bar";
import { CommandTab } from "./command-tab";
import { PipelineTab } from "./pipeline-tab";
import { CrawlMapTab } from "./crawl-map-tab";
import { MLIntelligenceTab } from "./ml-intelligence-tab";
import { TestUsersTab } from "./test-users-tab";
import { ScoutTab } from "./scout-tab";
import { MatchesTab } from "./matches-tab";
import { DailyReportTab } from "./daily-report-tab";
import {
  LayoutDashboard,
  ClipboardCheck,
  GitBranch,
  Map,
  Brain,
  FlaskConical,
  Radar,
  Crosshair,
} from "lucide-react";

const TABS = [
  { id: "command", label: "Command", icon: LayoutDashboard },
  { id: "daily-report", label: "Daily Report", icon: ClipboardCheck },
  { id: "pipeline", label: "Pipeline", icon: GitBranch },
  { id: "crawl-map", label: "Crawl Map", icon: Map },
  { id: "matches", label: "Matches", icon: Crosshair },
  { id: "ml-intelligence", label: "ML Intelligence", icon: Brain },
  { id: "test-users", label: "Test Users", icon: FlaskConical },
  { id: "scout", label: "Scout", icon: Radar },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* eslint-disable @typescript-eslint/no-explicit-any */
type HealthData = Record<string, any> | null;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface CommandCenterProps {
  initialData: CommandCenterData;
}

export function CommandCenter({ initialData }: CommandCenterProps) {
  const [activeTab, setActiveTab] = useState<TabId>("command");
  const [health, setHealth] = useState<HealthData>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchPollingData() {
      try {
        const healthRes = await fetch("/api/admin/scanner/health");
        if (active && healthRes.ok) setHealth(await healthRes.json());
      } catch {
        // Silently fail — health bar shows degraded state
      }
    }
    fetchPollingData();
    const interval = setInterval(fetchPollingData, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const handleSwitchTab = (tabId: TabId, context?: { platform?: string }) => {
    setActiveTab(tabId);
    if (context?.platform) {
      setSelectedPlatform(context.platform);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <ScanLineHeader />
      <HealthPulseBar health={health} />

      {/* Tab bar */}
      <div className="border-b border-border/30">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "command" && (
        <CommandTab
          data={initialData}
          health={health}
          onSwitchTab={handleSwitchTab}
        />
      )}
      {activeTab === "daily-report" && (
        <DailyReportTab data={initialData} health={health} />
      )}
      {activeTab === "pipeline" && (
        <PipelineTab
          data={initialData}
          health={health}
          platforms={initialData.platforms}
        />
      )}
      {activeTab === "crawl-map" && (
        <CrawlMapTab
          sections={initialData.sections}
          platforms={initialData.platforms}
          initialPlatform={selectedPlatform}
        />
      )}
      {activeTab === "matches" && (
        <MatchesTab
          matches={initialData.recentMatches}
          pendingReviewCount={initialData.pipeline.matchesPendingReviewCount}
        />
      )}
      {activeTab === "ml-intelligence" && (
        <MLIntelligenceTab
          recommendations={initialData.recommendations}
          pendingRecsCount={initialData.pendingRecsCount}
          appliedRecs={initialData.appliedRecs}
          modelState={initialData.modelState}
          signalStats={initialData.signalStats}
          health={health}
        />
      )}
      {activeTab === "test-users" && (
        <TestUsersTab
          testUserSummary={initialData.testUserSummary}
          honeypotItems={initialData.honeypotItems}
        />
      )}
      {activeTab === "scout" && (
        <ScoutTab
          discoveries={initialData.scoutDiscoveries}
          runs={initialData.scoutRuns}
          keywords={initialData.scoutKeywords}
        />
      )}
    </div>
  );
}
