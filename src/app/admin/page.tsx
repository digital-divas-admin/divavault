import Link from "next/link";
import { getAdminStats, getRecentAdminActivity } from "@/lib/admin-queries";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminActivityFeed } from "@/components/admin/admin-activity-feed";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ClipboardCheck,
  DollarSign,
  Rocket,
  Pause,
  CheckCircle2,
  Plus,
  Users,
  Upload,
  Wallet,
  UserPlus,
  Key,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const [stats, activity] = await Promise.all([
    getAdminStats(),
    getRecentAdminActivity(10),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage requests, users, and payouts
          </p>
        </div>
        <Link href="/admin/requests/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </Link>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          icon={Users}
          value={stats.totalUsers}
          label="Total Users"
          iconClassName="text-primary"
          iconBgClassName="bg-primary/10"
        />
        <AdminStatCard
          icon={UserPlus}
          value={stats.newSignupsToday}
          label="New Today"
          iconClassName="text-green-400"
          iconBgClassName="bg-green-500/10"
        />
        <AdminStatCard
          icon={Upload}
          value={stats.totalSubmissions}
          label="Total Submissions"
          iconClassName="text-blue-400"
          iconBgClassName="bg-blue-500/10"
        />
        <AdminStatCard
          icon={ClipboardCheck}
          value={stats.pendingReviews}
          label="Pending Reviews"
          iconClassName="text-yellow-400"
          iconBgClassName="bg-yellow-500/10"
        />
      </div>

      {/* Request stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          icon={FileText}
          value={stats.totalRequests}
          label="Total Requests"
        />
        <AdminStatCard
          icon={Rocket}
          value={stats.publishedRequests}
          label="Published"
          iconClassName="text-green-400"
          iconBgClassName="bg-green-500/10"
        />
        <AdminStatCard
          icon={DollarSign}
          value={`$${(stats.budgetSpent / 100).toFixed(0)} / $${(stats.budgetTotal / 100).toFixed(0)}`}
          label="Budget Spent / Total"
          iconClassName="text-blue-400"
          iconBgClassName="bg-blue-500/10"
        />
        <AdminStatCard
          icon={CheckCircle2}
          value={stats.fulfilledRequests}
          label="Fulfilled"
          iconClassName="text-blue-400"
          iconBgClassName="bg-blue-500/10"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminStatCard
          icon={FileText}
          value={stats.draftRequests}
          label="Drafts"
          iconClassName="text-muted-foreground"
          iconBgClassName="bg-muted/30"
        />
        <AdminStatCard
          icon={Pause}
          value={stats.pausedRequests}
          label="Paused"
          iconClassName="text-orange-400"
          iconBgClassName="bg-orange-500/10"
        />
        <AdminStatCard
          icon={UserPlus}
          value={`${stats.newSignupsThisWeek} / ${stats.newSignupsThisMonth}`}
          label="Signups This Week / Month"
          iconClassName="text-green-400"
          iconBgClassName="bg-green-500/10"
        />
      </div>

      {/* Quick links + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Link href="/admin/requests">
            <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Manage Requests</p>
                  <p className="text-xs text-muted-foreground">
                    View, create, and edit bounty requests
                  </p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/admin/review-queue">
            <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="font-medium">Review Queue</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.pendingReviews} submissions waiting for review
                  </p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/admin/users">
            <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Manage Users</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalUsers} registered contributors
                  </p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/admin/payouts">
            <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Payouts</p>
                  <p className="text-xs text-muted-foreground">
                    Track and manage contributor earnings
                  </p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/admin/api-keys">
            <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">API Keys</p>
                  <p className="text-xs text-muted-foreground">
                    Manage platform API keys and webhook log
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>
        <AdminActivityFeed items={activity} />
      </div>
    </div>
  );
}
