"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import {
  Megaphone,
  Bot,
  Image,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Crosshair,
  Briefcase,
} from "lucide-react";

import { PipelineStatusCard } from "./pipeline-status";
import { PipelineControls } from "./pipeline-controls";
import { AddAdForm } from "./add-ad-form";
import { FaceBrowser } from "./face-browser";
import { ConfigEditor } from "./config-editor";
import { ActivityFeed } from "./activity-feed";

interface AdIntelStats {
  adsScanned: number;
  aiFacesFound: number;
  stockMatches: number;
  pendingReview: number;
  confirmed: number;
  dismissed: number;
  escalated: number;
}

export function DashboardTabs({ stats }: { stats: AdIntelStats }) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="controls">Controls</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6 mt-4">
        {/* Pipeline Overview */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Pipeline Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AdminStatCard
              icon={Megaphone}
              value={stats.adsScanned}
              label="Ads Scanned"
              iconClassName="text-primary"
              iconBgClassName="bg-primary/10"
            />
            <AdminStatCard
              icon={Bot}
              value={stats.aiFacesFound}
              label="AI Faces Found"
              iconClassName="text-purple-600"
              iconBgClassName="bg-purple-500/10"
            />
            <AdminStatCard
              icon={Image}
              value={stats.stockMatches}
              label="Stock Candidates"
              iconClassName="text-blue-400"
              iconBgClassName="bg-blue-500/10"
            />
          </div>
        </div>

        {/* Pipeline Queue Status */}
        <PipelineStatusCard />

        {/* Review Status */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Review Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatCard
              icon={Clock}
              value={stats.pendingReview}
              label="Pending Review"
              iconClassName="text-yellow-400"
              iconBgClassName="bg-yellow-500/10"
            />
            <AdminStatCard
              icon={CheckCircle2}
              value={stats.confirmed}
              label="Confirmed"
              iconClassName="text-green-400"
              iconBgClassName="bg-green-500/10"
            />
            <AdminStatCard
              icon={XCircle}
              value={stats.dismissed}
              label="Dismissed"
              iconClassName="text-muted-foreground"
              iconBgClassName="bg-muted/10"
            />
            <AdminStatCard
              icon={AlertTriangle}
              value={stats.escalated}
              label="Escalated"
              iconClassName="text-red-400"
              iconBgClassName="bg-red-500/10"
            />
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/admin/ad-intel/matches">
            <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <Crosshair className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">View Matches</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.pendingReview} pending match
                    {stats.pendingReview !== 1 ? "es" : ""} to review
                  </p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/admin/ad-intel/jobs">
            <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">Ad Scan Jobs</p>
                  <p className="text-xs text-muted-foreground">
                    View ad intelligence scan history
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </TabsContent>

      {/* Controls Tab */}
      <TabsContent value="controls" className="space-y-6 mt-4">
        <PipelineControls />
        <AddAdForm />
        <FaceBrowser />
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="mt-4">
        <ConfigEditor />
      </TabsContent>

      {/* Activity Tab */}
      <TabsContent value="activity" className="mt-4">
        <ActivityFeed />
      </TabsContent>
    </Tabs>
  );
}
