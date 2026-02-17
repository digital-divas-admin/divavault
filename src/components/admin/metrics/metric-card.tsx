"use client";

import { ArrowUp, ArrowDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeType = "neutral",
  subtitle,
}: MetricCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border/30 p-5">
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {change !== undefined && (
          <span
            className={`flex items-center text-xs font-medium pb-1 ${
              changeType === "positive"
                ? "text-green-600"
                : changeType === "negative"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {changeType === "positive" ? (
              <ArrowUp className="h-3 w-3 mr-0.5" />
            ) : changeType === "negative" ? (
              <ArrowDown className="h-3 w-3 mr-0.5" />
            ) : null}
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
