import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Upload, Rocket } from "lucide-react";
import type { AdminActivityItem } from "@/lib/admin-queries";

const iconMap = {
  signup: { icon: UserPlus, className: "text-green-500 bg-green-500/10" },
  submission: { icon: Upload, className: "text-blue-500 bg-blue-500/10" },
  published: { icon: Rocket, className: "text-purple-500 bg-purple-500/10" },
};

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface AdminActivityFeedProps {
  items: AdminActivityItem[];
}

export function AdminActivityFeed({ items }: AdminActivityFeedProps) {
  if (items.length === 0) {
    return (
      <Card className="bg-card border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/30">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => {
          const { icon: Icon, className } = iconMap[item.type];
          return (
            <div key={i} className="flex items-start gap-3">
              <div className={`rounded-full p-1.5 shrink-0 ${className}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {relativeTime(item.timestamp)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
