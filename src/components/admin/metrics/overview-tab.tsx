"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { MetricCard } from "./metric-card";
import { SectionHeader } from "./section-header";
import { ChartCard } from "./chart-card";

interface OverviewTabProps {
  data: {
    overview: {
      enrollmentsThisWeek: number;
      enrollmentChange: number;
      takedownSuccessRate: number;
      totalProtected: number;
      totalMatches: number;
      mrr: number;
      mrrChange: number;
      conversion: number;
      conversionChange: number;
      timeToScan: { week: string; hours: number }[];
    };
    enrollments: {
      week: string;
      value: number;
      free: number;
      paid: number;
    }[];
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

export function OverviewTab({ data }: OverviewTabProps) {
  const { overview, enrollments } = data;

  return (
    <div className="space-y-8">
      <SectionHeader
        label="Overview"
        title="Core Metrics"
        description="Key performance indicators across enrollment, protection, and revenue"
      />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="New Enrollments"
          value={overview.enrollmentsThisWeek}
          change={overview.enrollmentChange}
          changeType={
            overview.enrollmentChange > 0
              ? "positive"
              : overview.enrollmentChange < 0
                ? "negative"
                : "neutral"
          }
          subtitle="This week"
        />
        <MetricCard
          label="Takedown Success"
          value={`${overview.takedownSuccessRate}%`}
          changeType="neutral"
          subtitle="All time resolution rate"
        />
        {/* TODO: MRR requires billing tables */}
        <MetricCard
          label="Monthly Revenue"
          value={overview.mrr > 0 ? `$${overview.mrr.toLocaleString()}` : "\u2014"}
          change={overview.mrrChange || undefined}
          changeType={
            overview.mrrChange > 0
              ? "positive"
              : overview.mrrChange < 0
                ? "negative"
                : "neutral"
          }
          subtitle={overview.mrr > 0 ? "MRR" : "Needs billing data"}
        />
        {/* TODO: Conversion requires subscription tracking */}
        <MetricCard
          label="Free \u2192 Paid"
          value={
            overview.conversion > 0 ? `${overview.conversion}%` : "\u2014"
          }
          change={overview.conversionChange || undefined}
          changeType={
            overview.conversionChange > 0
              ? "positive"
              : overview.conversionChange < 0
                ? "negative"
                : "neutral"
          }
          subtitle={
            overview.conversion > 0
              ? "Conversion rate"
              : "Needs subscription data"
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Weekly Enrollments">
          <AreaChart data={enrollments}>
            <defs>
              <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="free"
              name="Free"
              stackId="1"
              stroke="#DC2626"
              fill="url(#enrollGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="paid"
              name="Paid"
              stackId="1"
              stroke="#22C55E"
              fill="#22C55E"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartCard>

        {/* TODO: Time to First Scan requires timestamp tracking */}
        <ChartCard title="Time to First Scan (hours)">
          <AreaChart data={overview.timeToScan}>
            <defs>
              <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="hours"
              name="Hours"
              stroke="#3B82F6"
              fill="url(#scanGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartCard>
      </div>

      {/* Bottom stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-card rounded-xl border border-border/30 p-5">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Total Protected
          </p>
          <p className="text-2xl font-bold mt-1">
            {overview.totalProtected.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Total Matches
          </p>
          <p className="text-2xl font-bold mt-1">
            {overview.totalMatches.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Takedown Rate
          </p>
          <p className="text-2xl font-bold mt-1">
            {overview.takedownSuccessRate}%
          </p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">
            Avg Time to Scan
          </p>
          {/* TODO: Real avg from instrumented data */}
          <p className="text-2xl font-bold mt-1">{"\u2014"}</p>
          <p className="text-xs text-muted-foreground">Needs data</p>
        </div>
      </div>
    </div>
  );
}
