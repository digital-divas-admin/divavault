"use client";

import { useState } from "react";
import type { DailySnapshot } from "@/lib/scanner-coverage-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CoverageTrendsProps {
  snapshots: DailySnapshot[];
}

type TimeRange = "7d" | "30d" | "90d";

export function CoverageTrends({ snapshots }: CoverageTrendsProps) {
  const [range, setRange] = useState<TimeRange>("30d");

  const rangeDays: Record<TimeRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
  // Use latest snapshot date as anchor to avoid Date.now() purity lint issue
  const latestDate = snapshots.length > 0
    ? new Date(snapshots[snapshots.length - 1].snapshot_date + "T23:59:59Z").getTime()
    : 0;
  const cutoff = latestDate > 0
    ? new Date(latestDate - rangeDays[range] * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    : "1970-01-01";

  const filtered = snapshots.filter((s) => s.snapshot_date >= cutoff);

  // Aggregate across platforms per date
  const dateMap = new Map<
    string,
    {
      date: string;
      images: number;
      faces: number;
      matches: number;
      confirmed: number;
    }
  >();

  for (const s of filtered) {
    const existing = dateMap.get(s.snapshot_date);
    if (existing) {
      existing.images += s.images_discovered;
      existing.faces += s.images_with_faces;
      existing.matches += s.matches_found;
      existing.confirmed += s.matches_confirmed;
    } else {
      dateMap.set(s.snapshot_date, {
        date: s.snapshot_date,
        images: s.images_discovered,
        faces: s.images_with_faces,
        matches: s.matches_found,
        confirmed: s.matches_confirmed,
      });
    }
  }

  const chartData = [...dateMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (chartData.length === 0) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No snapshot data yet. Snapshots are captured daily.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">
            Historical Trends
          </h3>
          <div className="flex gap-1">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? "default" : "outline"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                tickFormatter={(v: string) => {
                  const d = new Date(v + "T00:00:00");
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "10px" }}
              />
              <Line
                type="monotone"
                dataKey="images"
                name="Images Discovered"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="faces"
                name="Faces Found"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="matches"
                name="Matches"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="confirmed"
                name="Confirmed"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
