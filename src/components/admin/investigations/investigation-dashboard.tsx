"use client";

import { useState, useEffect, useCallback } from "react";
import type { InvestigationDetail } from "@/types/investigations";
import { OverviewTab } from "./overview-tab";
import { MediaTab } from "./media-tab";
import { FrameViewerTab } from "./frame-viewer-tab";
import { MetadataTab } from "./metadata-tab";
import { EvidenceTab } from "./evidence-tab";
import { PublishTab } from "./publish-tab";
import { TaskStatusBar } from "./task-status-bar";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "media", label: "Media" },
  { key: "frames", label: "Frame Analysis" },
  { key: "metadata", label: "Metadata" },
  { key: "evidence", label: "Evidence" },
  { key: "publish", label: "Publish" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function InvestigationDashboard({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [data, setData] = useState<InvestigationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/admin/investigations/${id}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading investigation...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-destructive">Investigation not found</div>
      </div>
    );
  }

  const activeTasks = data.tasks.filter(
    (t) => t.status === "pending" || t.status === "running"
  );

  return (
    <div className="space-y-4">
      {/* Task status bar */}
      {activeTasks.length > 0 && (
        <TaskStatusBar tasks={activeTasks} investigationId={id} onUpdate={loadData} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-card rounded-lg p-1 border border-border/50 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.key === "media" && data.media.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{data.media.length}</span>
            )}
            {tab.key === "frames" && data.frames.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{data.frames.length}</span>
            )}
            {tab.key === "evidence" && data.evidence.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{data.evidence.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && <OverviewTab data={data} onUpdate={loadData} />}
        {activeTab === "media" && <MediaTab data={data} onUpdate={loadData} />}
        {activeTab === "frames" && <FrameViewerTab data={data} onUpdate={loadData} />}
        {activeTab === "metadata" && <MetadataTab data={data} onUpdate={loadData} />}
        {activeTab === "evidence" && <EvidenceTab data={data} onUpdate={loadData} />}
        {activeTab === "publish" && <PublishTab data={data} onUpdate={loadData} />}
      </div>
    </div>
  );
}
