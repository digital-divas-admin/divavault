"use client";

import { useState } from "react";
import Link from "next/link";
import type { BountyRequest } from "@/types/marketplace";
import { RequestStatusBadge } from "@/components/admin/request-status-badge";
import { BountyBadge } from "@/components/marketplace/bounty-badge";
import { ProgressIndicator } from "@/components/marketplace/progress-indicator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "paused", label: "Paused" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "closed", label: "Closed" },
] as const;

interface RequestListProps {
  requests: BountyRequest[];
}

export function RequestList({ requests }: RequestListProps) {
  const [activeTab, setActiveTab] = useState("all");

  const filtered =
    activeTab === "all"
      ? requests
      : requests.filter((r) => r.status === activeTab);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card">
          {tabs.map((tab) => {
            const count =
              tab.value === "all"
                ? requests.length
                : requests.filter((r) => r.status === tab.value).length;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No requests found
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((request) => (
            <Link key={request.id} href={`/admin/requests/${request.id}`}>
              <div className="p-4 rounded-lg border border-border/30 bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm truncate">
                        {request.title}
                      </h3>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="capitalize">
                        {request.category.replaceAll("_", " ")}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <BountyBadge
                      payAmountCents={request.pay_amount_cents}
                      payType={request.pay_type}
                    />
                    <ProgressIndicator
                      fulfilled={request.quantity_fulfilled}
                      needed={request.quantity_needed}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
