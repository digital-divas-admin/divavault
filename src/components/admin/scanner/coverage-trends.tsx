"use client";

import { useState, useMemo, useCallback } from "react";
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
import type { LegendPayload } from "recharts";

interface CoverageTrendsProps {
  snapshots: DailySnapshot[];
}

type TimeRange = "7d" | "30d" | "90d";

interface ChartDatum {
  date: string;
  images: number;
  faces: number;
  matches: number;
  confirmed: number;
}

const SERIES = [
  { key: "images", name: "Images Discovered", stroke: "#8B5CF6", axis: "left" },
  { key: "faces", name: "Faces Found", stroke: "#3b82f6", axis: "left" },
  { key: "matches", name: "Matches", stroke: "#f59e0b", axis: "right" },
  { key: "confirmed", name: "Confirmed", stroke: "#22c55e", axis: "right" },
] as const;

const RANGE_DAYS: Record<TimeRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

const AXIS_TICK = { fontSize: 10, fill: "#a1a1aa" } as const;

const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "6px",
  fontSize: "11px",
} as const;

const TOOLTIP_LABEL_STYLE = { color: "#a1a1aa" } as const;

const LEGEND_WRAPPER_STYLE = { fontSize: "10px" } as const;

function formatYAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

export function CoverageTrends({ snapshots }: CoverageTrendsProps) {
  const [range, setRange] = useState<TimeRange>("30d");
  const [platform, setPlatform] = useState<string>("all");
  const [showDelta, setShowDelta] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Derive unique platforms from snapshot data
  const platforms = useMemo(
    () => [...new Set(snapshots.map((s) => s.platform))].sort(),
    [snapshots]
  );

  // Time-range cutoff anchored to latest snapshot date
  const cutoff = useMemo(() => {
    if (snapshots.length === 0) return "1970-01-01";
    const latestDate = new Date(
      snapshots[snapshots.length - 1].snapshot_date + "T23:59:59Z"
    ).getTime();
    return new Date(latestDate - RANGE_DAYS[range] * 86_400_000)
      .toISOString()
      .split("T")[0];
  }, [snapshots, range]);

  // Build chart data: filter by platform, aggregate by date, optionally compute deltas
  const chartData = useMemo(() => {
    const filtered = snapshots.filter(
      (s) =>
        s.snapshot_date >= cutoff &&
        (platform === "all" || s.platform === platform)
    );

    // Aggregate across platforms per date
    const dateMap = new Map<string, ChartDatum>();
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

    const sorted = [...dateMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    if (!showDelta || sorted.length < 2) return sorted;

    // Compute day-over-day deltas, clamping negatives to 0
    const deltas: ChartDatum[] = [];
    for (let i = 1; i < sorted.length; i++) {
      deltas.push({
        date: sorted[i].date,
        images: Math.max(0, sorted[i].images - sorted[i - 1].images),
        faces: Math.max(0, sorted[i].faces - sorted[i - 1].faces),
        matches: Math.max(0, sorted[i].matches - sorted[i - 1].matches),
        confirmed: Math.max(0, sorted[i].confirmed - sorted[i - 1].confirmed),
      });
    }
    return deltas;
  }, [snapshots, cutoff, platform, showDelta]);

  // Legend click toggles series visibility
  const handleLegendClick = useCallback((entry: LegendPayload) => {
    const key = String(entry.dataKey);
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (chartData.length === 0) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No snapshot data yet. Snapshots are captured daily.
        </CardContent>
      </Card>
    );
  }

  // Platform pill options: "all" + each unique platform
  const pillOptions = ["all", ...platforms];

  return (
    <Card className="bg-card border-border/30">
      <CardContent className="p-4">
        {/* Header row: title + time range + delta toggle */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">
            Historical Trends
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant={showDelta ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setShowDelta((d) => !d)}
            >
              Daily &Delta;
            </Button>
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
        </div>

        {/* Platform filter pills */}
        {platforms.length > 1 && (
          <div className="flex items-center gap-1 bg-card rounded-lg border border-border/30 p-1 overflow-x-auto mb-3">
            {pillOptions.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap capitalize ${
                  platform === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                tickFormatter={(v: string) => {
                  const d = new Date(v + "T00:00:00");
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                yAxisId="left"
                tick={AXIS_TICK}
                tickFormatter={formatYAxis}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS_TICK}
                tickFormatter={formatYAxis}
              />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
              />
              <Legend
                wrapperStyle={LEGEND_WRAPPER_STYLE}
                onClick={handleLegendClick}
                formatter={(value: string, entry: LegendPayload) => {
                  const isHidden = hiddenSeries.has(String(entry.dataKey));
                  return (
                    <span
                      style={{
                        color: isHidden ? "#52525b" : "#a1a1aa",
                        cursor: "pointer",
                        textDecoration: isHidden ? "line-through" : "none",
                      }}
                    >
                      {value}
                    </span>
                  );
                }}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  yAxisId={s.axis}
                  stroke={s.stroke}
                  strokeWidth={2}
                  hide={hiddenSeries.has(s.key)}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
