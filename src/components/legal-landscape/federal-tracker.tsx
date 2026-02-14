"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillStatusBadge } from "./bill-status-badge";
import { GlossaryText } from "./glossary-text";
import { federalBills } from "@/data/legal-landscape/federal-bills";
import type { BillStatus } from "@/data/legal-landscape/types";

const STATUS_ORDER: BillStatus[] = [
  "signed",
  "passed",
  "committee",
  "introduced",
  "expired",
];

const STATUS_COLORS: Record<BillStatus, string> = {
  signed: "#22C55E",
  passed: "#4ADE80",
  committee: "#8B5CF6",
  introduced: "#A1A1AA",
  expired: "#EF4444",
};

const STATUS_LABELS: Record<BillStatus, string> = {
  signed: "Signed",
  passed: "Passed",
  committee: "Committee",
  introduced: "Introduced",
  expired: "Expired",
};

export function FederalTracker() {
  const sortedBills = useMemo(() => {
    return [...federalBills].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<BillStatus, number> = {
      signed: 0,
      passed: 0,
      committee: 0,
      introduced: 0,
      expired: 0,
    };
    for (const bill of federalBills) {
      counts[bill.status]++;
    }
    return counts;
  }, []);

  const totalBills = federalBills.length;

  return (
    <div className="space-y-6">
      {/* Pipeline summary bar */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Legislative Pipeline
        </h3>
        <div className="flex h-10 rounded-lg overflow-hidden">
          {STATUS_ORDER.map((status) => {
            const count = statusCounts[status];
            if (count === 0) return null;
            const widthPercent = (count / totalBills) * 100;

            return (
              <div
                key={status}
                className="flex items-center justify-center text-xs font-semibold text-white transition-all"
                style={{
                  backgroundColor: STATUS_COLORS[status],
                  width: `${widthPercent}%`,
                  minWidth: count > 0 ? "2.5rem" : 0,
                }}
                title={`${STATUS_LABELS[status]}: ${count}`}
              >
                {count}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4">
          {STATUS_ORDER.map((status) => {
            const count = statusCounts[status];
            if (count === 0) return null;
            return (
              <div key={status} className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABELS[status]} ({count})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bill cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedBills.map((bill) => (
          <Card key={bill.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {bill.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {bill.billNumber}
                  </p>
                </div>
                <BillStatusBadge status={bill.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Sponsors:</span>{" "}
                {bill.sponsors.join(", ")}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <GlossaryText text={bill.summary} />
              </p>
              <p className="text-xs text-muted-foreground border-t border-zinc-800 pt-3">
                Last action: {bill.lastActionDate} &mdash; {bill.lastAction}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
