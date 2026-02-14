"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Play,
  Plus,
  Search,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";

interface ActivityItem {
  id: string;
  event_type: string;
  stage: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const EVENT_ICONS: Record<
  string,
  { icon: typeof Play; className: string }
> = {
  scan_triggered: { icon: Play, className: "text-blue-400" },
  ad_added: { icon: Plus, className: "text-blue-400" },
  face_searched: { icon: Search, className: "text-blue-400" },
  config_changed: { icon: Settings, className: "text-purple-400" },
  match_reviewed: { icon: CheckCircle2, className: "text-green-400" },
  stage_completed: { icon: Zap, className: "text-green-400" },
  error: { icon: AlertTriangle, className: "text-red-400" },
};

const EVENT_FILTERS = [
  { value: "all", label: "All" },
  { value: "scan_triggered", label: "Scans" },
  { value: "ad_added", label: "Ads" },
  { value: "config_changed", label: "Config" },
  { value: "match_reviewed", label: "Reviews" },
  { value: "error", label: "Errors" },
];

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchActivity = useCallback(
    async (offset = 0, append = false) => {
      try {
        const params = new URLSearchParams({ limit: "20", offset: String(offset) });
        if (filter !== "all") params.set("eventType", filter);

        const res = await fetch(`/api/admin/ad-intel/activity?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (append) {
            setItems((prev) => [...prev, ...data.items]);
          } else {
            setItems(data.items);
          }
          setTotal(data.total);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    setLoading(true);
    fetchActivity();
    const interval = setInterval(() => fetchActivity(), 15_000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchActivity(items.length, true);
  };

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Activity</CardTitle>
          <div className="flex gap-1">
            {EVENT_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No activity yet
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const eventMeta = EVENT_ICONS[item.event_type] || {
                icon: Zap,
                className: "text-muted-foreground",
              };
              const Icon = eventMeta.icon;

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/20 transition-colors"
                >
                  <div className="rounded-full bg-card border border-border/30 p-1.5 mt-0.5">
                    <Icon className={`h-3 w-3 ${eventMeta.className}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {timeAgo(item.created_at)}
                  </span>
                </div>
              );
            })}

            {items.length < total && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Load More ({total - items.length} remaining)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
