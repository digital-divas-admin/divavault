"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { MetricCard } from "./metric-card";
import { SectionHeader } from "./section-header";
import { ChartCard } from "./chart-card";
import { Lightbulb } from "lucide-react";

interface GrowthTabProps {
  data: {
    monthlyChurnRate: number;
    churnChange: number;
    referralRate: number;
    referralChange: number;
    acquisitionCost: number;
    acquisitionChange: number;
    organicVsReferred: {
      week: string;
      organic: number;
      referred: number;
    }[];
    churnReasons: {
      reason: string;
      count: number;
      percentage: number;
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

export function GrowthTab({ data }: GrowthTabProps) {
  return (
    <div className="space-y-8">
      <SectionHeader
        label="Growth"
        title="Growth & Retention"
        description="User acquisition, retention, and churn analysis"
      />

      {/* TODO: All growth metrics are mock — requires referral, churn, and acquisition tracking */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Monthly Churn"
          value={`${data.monthlyChurnRate}%`}
          change={data.churnChange}
          changeType={data.churnChange < 0 ? "positive" : "negative"}
          subtitle="Mock data"
        />
        <MetricCard
          label="Referral Rate"
          value={`${data.referralRate}%`}
          change={data.referralChange}
          changeType={data.referralChange > 0 ? "positive" : "negative"}
          subtitle="Mock data"
        />
        <MetricCard
          label="Acquisition Cost"
          value={`$${data.acquisitionCost}`}
          change={data.acquisitionChange}
          changeType={data.acquisitionChange < 0 ? "positive" : "negative"}
          subtitle="Mock data"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Organic vs Referred Signups">
          <AreaChart data={data.organicVsReferred}>
            <defs>
              <linearGradient id="organicGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="referredGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
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
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area
              type="monotone"
              dataKey="organic"
              name="Organic"
              stroke="#3B82F6"
              fill="url(#organicGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="referred"
              name="Referred"
              stroke="#22C55E"
              fill="url(#referredGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Why People Cancel" height={280}>
          <BarChart data={data.churnReasons} layout="vertical">
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
              dataKey="reason"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              width={130}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              dataKey="count"
              name="Users"
              fill="#F59E0B"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartCard>
      </div>

      {/* Insight box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            Growth Insight
          </p>
          <p className="text-sm text-blue-700 mt-1">
            Privacy concerns drive the most churn ({data.churnReasons[0]?.percentage}%).
            Consider adding more transparency about data handling on the enrollment page.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">
        All growth data is simulated. TODO: Instrument referral tracking,
        cancellation surveys, and acquisition cost tracking.
      </p>
    </div>
  );
}
