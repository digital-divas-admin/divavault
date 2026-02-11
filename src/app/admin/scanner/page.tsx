import Link from "next/link";
import { getScannerStats } from "@/lib/scanner-admin-queries";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import {
  Fingerprint,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ScanSearch,
  Play,
  XCircle,
  Target,
  Eye,
  Flame,
  Bot,
  FileWarning,
  Send,
  CheckCircle2,
  Image,
  CalendarClock,
  Globe,
} from "lucide-react";

export default async function ScannerDashboardPage() {
  const stats = await getScannerStats();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Scanner Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor likeness scanning, matches, and takedown activity
        </p>
      </div>

      {/* Embedding Pipeline */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Embedding Pipeline
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            icon={Fingerprint}
            value={stats.totalEmbeddings}
            label="Total Embeddings"
            iconClassName="text-primary"
            iconBgClassName="bg-primary/10"
          />
          <AdminStatCard
            icon={Clock}
            value={stats.pendingEmbeddings}
            label="Pending"
            iconClassName="text-yellow-400"
            iconBgClassName="bg-yellow-500/10"
          />
          <AdminStatCard
            icon={AlertTriangle}
            value={stats.failedEmbeddings}
            label="Failed"
            iconClassName="text-red-400"
            iconBgClassName="bg-red-500/10"
          />
          <AdminStatCard
            icon={ShieldCheck}
            value={stats.contributorsProtected}
            label="Contributors Protected"
            iconClassName="text-green-400"
            iconBgClassName="bg-green-500/10"
          />
        </div>
      </div>

      {/* Scan Activity (24h) */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Scan Activity (24h)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminStatCard
            icon={ScanSearch}
            value={stats.scansCompleted24h}
            label="Completed"
            iconClassName="text-green-400"
            iconBgClassName="bg-green-500/10"
          />
          <AdminStatCard
            icon={Play}
            value={stats.scansRunning}
            label="Running"
            iconClassName="text-blue-400"
            iconBgClassName="bg-blue-500/10"
          />
          <AdminStatCard
            icon={XCircle}
            value={stats.scansFailed24h}
            label="Failed"
            iconClassName="text-red-400"
            iconBgClassName="bg-red-500/10"
          />
        </div>
      </div>

      {/* Matches */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Matches
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            icon={Target}
            value={stats.totalMatches}
            label="Total Matches"
            iconClassName="text-primary"
            iconBgClassName="bg-primary/10"
          />
          <AdminStatCard
            icon={Eye}
            value={stats.newMatches}
            label="New / Unreviewed"
            iconClassName="text-yellow-400"
            iconBgClassName="bg-yellow-500/10"
          />
          <AdminStatCard
            icon={Flame}
            value={stats.highConfidenceNew}
            label="High Confidence New"
            iconClassName="text-red-400"
            iconBgClassName="bg-red-500/10"
          />
          <AdminStatCard
            icon={Bot}
            value={stats.aiGeneratedMatches}
            label="AI-Generated"
            iconClassName="text-purple-400"
            iconBgClassName="bg-purple-500/10"
          />
        </div>
      </div>

      {/* Takedowns */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Takedowns
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminStatCard
            icon={FileWarning}
            value={stats.takedownsPending}
            label="Pending"
            iconClassName="text-yellow-400"
            iconBgClassName="bg-yellow-500/10"
          />
          <AdminStatCard
            icon={Send}
            value={stats.takedownsSubmitted}
            label="Submitted"
            iconClassName="text-blue-400"
            iconBgClassName="bg-blue-500/10"
          />
          <AdminStatCard
            icon={CheckCircle2}
            value={stats.takedownsResolved}
            label="Resolved"
            iconClassName="text-green-400"
            iconBgClassName="bg-green-500/10"
          />
        </div>
      </div>

      {/* System */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          System
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminStatCard
            icon={Image}
            value={stats.discoveredImages}
            label="Discovered Images"
            iconClassName="text-primary"
            iconBgClassName="bg-primary/10"
          />
          <AdminStatCard
            icon={CalendarClock}
            value={stats.scheduledScans}
            label="Scheduled Scans"
            iconClassName="text-blue-400"
            iconBgClassName="bg-blue-500/10"
          />
          <AdminStatCard
            icon={Globe}
            value={stats.crawlSchedules}
            label="Crawl Schedules"
            iconClassName="text-purple-400"
            iconBgClassName="bg-purple-500/10"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/admin/scanner/matches">
          <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">View Matches</p>
                <p className="text-xs text-muted-foreground">
                  {stats.newMatches} new match{stats.newMatches !== 1 ? "es" : ""} to review
                </p>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/admin/scanner/jobs">
          <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <ScanSearch className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Scan Jobs</p>
                <p className="text-xs text-muted-foreground">
                  {stats.scansRunning} running, {stats.scansCompleted24h} completed today
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
