"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "./submission-status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { SubmissionWithRequest } from "@/types/marketplace";

const tabs = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "needs_revision", label: "Needs Revision" },
];

interface MySubmissionsListProps {
  submissions: SubmissionWithRequest[];
}

export function MySubmissionsList({ submissions }: MySubmissionsListProps) {
  const [activeTab, setActiveTab] = useState("all");

  const filtered = submissions.filter((s) => {
    if (activeTab === "all") return true;
    if (activeTab === "active")
      return ["draft", "submitted", "in_review"].includes(s.status);
    if (activeTab === "completed")
      return ["accepted", "rejected"].includes(s.status);
    if (activeTab === "needs_revision") return s.status === "revision_requested";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            variant="ghost"
            size="sm"
            className={`text-xs px-3 h-7 ${
              activeTab === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Send}
          heading="No submissions yet"
          message="Browse the marketplace to find your first opportunity. Every contribution earns real money."
          action={{ label: "Browse Marketplace", href: "/dashboard/marketplace" }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((submission) => {
            const req = submission.bounty_requests;
            const earned =
              submission.earned_amount_cents + submission.bonus_amount_cents;

            return (
              <Link
                key={submission.id}
                href={`/dashboard/marketplace/${submission.request_id}/submit`}
              >
                <Card className="bg-card/50 border-border/30 hover:border-neon/30 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">
                          {req.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <SubmissionStatusBadge status={submission.status} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(
                              submission.updated_at
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {earned > 0 && (
                          <p className="text-sm font-medium text-green-400">
                            ${(earned / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
