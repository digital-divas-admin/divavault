import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { AdminActivityItem } from "@/lib/admin-queries";

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
        {items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="rounded-full p-1.5 shrink-0 text-green-500 bg-green-500/10">
                <UserPlus className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {timeAgo(item.timestamp)}
              </span>
            </div>
        ))}
      </CardContent>
    </Card>
  );
}
