import Link from "next/link";
import { getAdminStats, getRecentAdminActivity } from "@/lib/admin-queries";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminActivityFeed } from "@/components/admin/admin-activity-feed";
import {
  Users,
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
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage users and platform settings
        </p>
      </div>

      {/* User stat cards */}
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
          icon={UserPlus}
          value={stats.newSignupsThisWeek}
          label="This Week"
          iconClassName="text-blue-400"
          iconBgClassName="bg-blue-500/10"
        />
        <AdminStatCard
          icon={UserPlus}
          value={stats.newSignupsThisMonth}
          label="This Month"
          iconClassName="text-purple-400"
          iconBgClassName="bg-purple-500/10"
        />
      </div>

      {/* Quick links + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
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
