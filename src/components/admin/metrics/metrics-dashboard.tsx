"use client";

import { useState, useEffect, useCallback } from "react";
import { OverviewTab } from "./overview-tab";
import { FunnelTab } from "./funnel-tab";
import { EnforcementTab } from "./enforcement-tab";
import { GrowthTab } from "./growth-tab";
import { MarketplaceTab } from "./marketplace-tab";
import { Loader2 } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "funnel", label: "Funnel" },
  { id: "enforcement", label: "Enforcement" },
  { id: "growth", label: "Growth" },
  { id: "marketplace", label: "Marketplace" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TIME_RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
type MetricsData = Record<string, any> | null;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MetricsDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [timeRange, setTimeRange] = useState("30");
  const [data, setData] = useState<MetricsData>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/metrics?range=${timeRange}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail — dashboard will show empty state
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Business health dashboard
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center bg-card rounded-lg border border-border/30 p-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                timeRange === range.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border/30">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Failed to load metrics data.
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <OverviewTab
              data={{
                overview: data.overview,
                enrollments: data.enrollments,
              }}
            />
          )}
          {activeTab === "funnel" && <FunnelTab data={data.funnel} />}
          {activeTab === "enforcement" && (
            <EnforcementTab data={data.enforcement} />
          )}
          {activeTab === "growth" && <GrowthTab data={data.growth} />}
          {activeTab === "marketplace" && (
            <MarketplaceTab data={data.marketplace} />
          )}
        </>
      )}
    </div>
  );
}
