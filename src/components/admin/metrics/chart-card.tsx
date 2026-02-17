"use client";

import { ResponsiveContainer } from "recharts";

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  height?: number;
}

export function ChartCard({ title, children, height = 280 }: ChartCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border/30 p-5">
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
        {title}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}
