"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SectionHeader } from "./section-header";
import { ChartCard } from "./chart-card";

interface EnforcementTabProps {
  data: {
    matchesTakedownsByWeek: {
      week: string;
      matches: number;
      takedowns: number;
    }[];
    matchesByPlatform: { platform: string; count: number }[];
    takedownByPlatform: {
      platform: string;
      total: number;
      resolved: number;
      successRate: number;
      avgResponseDays: number;
    }[];
    totalStats: {
      totalEnrolled: number;
      totalMatches: number;
      totalTakedownsResolved: number;
      totalTakedownsSubmitted: number;
      takedownSuccessRate: number;
    };
  };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/30 rounded-lg p-3 text-xs shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function EnforcementTab({ data }: EnforcementTabProps) {
  const {
    matchesTakedownsByWeek,
    matchesByPlatform,
    takedownByPlatform,
    totalStats,
  } = data;

  const hasMatchData = matchesTakedownsByWeek.some(
    (w) => w.matches > 0 || w.takedowns > 0
  );
  const hasPlatformData = matchesByPlatform.length > 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        label="Enforcement"
        title="Match & Takedown Performance"
        description="Real-time data from the scanning and enforcement pipeline"
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border/30 p-4">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Total Matches
          </p>
          <p className="text-2xl font-bold mt-1">
            {totalStats.totalMatches.toLocaleString()}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border/30 p-4">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Takedowns Filed
          </p>
          <p className="text-2xl font-bold mt-1">
            {totalStats.totalTakedownsSubmitted.toLocaleString()}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border/30 p-4">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Resolved
          </p>
          <p className="text-2xl font-bold mt-1 text-green-600">
            {totalStats.totalTakedownsResolved.toLocaleString()}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border/30 p-4">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Success Rate
          </p>
          <p className="text-2xl font-bold mt-1">
            {totalStats.takedownSuccessRate}%
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Matches vs Takedowns by Week">
          {hasMatchData ? (
            <BarChart data={matchesTakedownsByWeek}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                opacity={0.3}
              />
              <XAxis
                dataKey="week"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <Bar
                dataKey="matches"
                name="Matches"
                fill="#DC2626"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="takedowns"
                name="Takedowns"
                fill="#22C55E"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </ChartCard>

        <ChartCard title="Matches by Platform" height={280}>
          {hasPlatformData ? (
            <BarChart
              data={matchesByPlatform.slice(0, 8)}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                opacity={0.3}
                horizontal={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                dataKey="platform"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                width={100}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="count"
                name="Matches"
                fill="#3B82F6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </ChartCard>
      </div>

      {/* Takedown success by platform */}
      {takedownByPlatform.length > 0 && (
        <>
          <h3 className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Takedown Success by Platform
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {takedownByPlatform.map((p) => (
              <div
                key={p.platform}
                className="bg-card rounded-xl border border-border/30 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">{p.platform}</span>
                  <span
                    className={`text-sm font-bold ${
                      p.successRate >= 80
                        ? "text-green-600"
                        : p.successRate >= 50
                          ? "text-amber-500"
                          : "text-destructive"
                    }`}
                  >
                    {p.successRate}%
                  </span>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full ${
                      p.successRate >= 80
                        ? "bg-green-500"
                        : p.successRate >= 50
                          ? "bg-amber-500"
                          : "bg-destructive"
                    }`}
                    style={{ width: `${p.successRate}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {p.resolved}/{p.total} resolved
                  </span>
                  <span>
                    {p.avgResponseDays > 0
                      ? `~${p.avgResponseDays}d avg`
                      : "No response data"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
