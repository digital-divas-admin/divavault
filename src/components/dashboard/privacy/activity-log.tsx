import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ImageIcon,
  Shield,
  Download,
  Trash2,
  ToggleLeft,
  Activity,
} from "lucide-react";
import type { ActivityLog as ActivityLogType } from "@/types/dashboard";

const actionIcons: Record<string, typeof Activity> = {
  photo_removed: ImageIcon,
  opted_out: ToggleLeft,
  opted_in: ToggleLeft,
  data_export: Download,
  deletion_requested: Trash2,
  profile_updated: Shield,
};

interface ActivityLogProps {
  activities: ActivityLogType[];
}

export function ActivityLog({ activities }: ActivityLogProps) {
  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {activities.map((activity) => {
                const Icon = actionIcons[activity.action] || Activity;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="rounded-full bg-muted/50 p-1.5 shrink-0 mt-0.5">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs">{activity.description}</p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {new Date(activity.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
