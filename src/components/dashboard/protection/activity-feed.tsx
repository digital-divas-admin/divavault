import { Radar, Target, Gavel, Bell } from "lucide-react";
import type { ProtectionActivity } from "@/types/protection";

const iconMap = {
  scan: Radar,
  match: Target,
  takedown: Gavel,
  notification: Bell,
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({
  activities,
}: {
  activities: ProtectionActivity[];
}) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Radar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          No recent activity yet. Scans will appear here once started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const Icon = iconMap[activity.type] || Bell;
        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 py-2"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{activity.title}</p>
              <p className="text-xs text-muted-foreground">
                {activity.description}
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {timeAgo(activity.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
