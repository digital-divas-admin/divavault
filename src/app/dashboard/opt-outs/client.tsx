"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { OptOutCompanyCard } from "@/components/dashboard/opt-outs/optout-company-card";
import { OptOutFilters } from "@/components/dashboard/opt-outs/optout-filters";
import { SendBatchDialog } from "@/components/dashboard/opt-outs/send-batch-dialog";
import type { OptOutCompanyView, OptOutStats } from "@/types/optout";

interface OptOutPageClientProps {
  views: OptOutCompanyView[];
  stats: OptOutStats;
  userName: string;
}

export function OptOutPageClient({ views, stats, userName }: OptOutPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const statusFilter = searchParams.get("status") || "all";
  const methodFilter = searchParams.get("method") || "all";

  // Filter views
  let filtered = views;
  if (statusFilter !== "all") {
    if (statusFilter === "completed") {
      filtered = filtered.filter(v =>
        v.request?.status === "confirmed" ||
        v.request?.status === "completed_web" ||
        v.request?.status === "completed_settings"
      );
    } else if (statusFilter === "not_started") {
      filtered = filtered.filter(v => !v.request || v.request.status === "not_started");
    } else {
      filtered = filtered.filter(v => v.request?.status === statusFilter);
    }
  }
  if (methodFilter !== "all") {
    filtered = filtered.filter(v => v.company.method === methodFilter);
  }

  // Companies eligible for batch send
  const batchEligible = views.filter(v =>
    (v.company.method === "email" || v.company.method === "none") &&
    v.company.contactEmail &&
    (!v.request || v.request.status === "not_started")
  ).map(v => v.company);

  const handleUpdate = () => router.refresh();

  const handleBatchSend = async () => {
    setBatchLoading(true);
    try {
      await fetch("/api/dashboard/opt-outs/send-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      router.refresh();
    } finally {
      setBatchLoading(false);
      setBatchOpen(false);
    }
  };

  return (
    <>
      {/* Batch action bar */}
      {batchEligible.length > 0 && (
        <div className="flex items-center justify-between p-4 mb-6 rounded-xl border border-primary/20 bg-primary/5">
          <div>
            <p className="text-sm font-medium">Send opt-out notices to all email-based companies</p>
            <p className="text-xs text-muted-foreground mt-0.5">{batchEligible.length} companies can be contacted via email</p>
          </div>
          <Button onClick={() => setBatchOpen(true)} className="shrink-0">
            <Send className="h-4 w-4 mr-2" />
            Send to All ({batchEligible.length})
          </Button>
        </div>
      )}

      <SendBatchDialog
        companies={batchEligible}
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onSendBatch={handleBatchSend}
      />

      {/* Filters */}
      <div className="mb-6">
        <OptOutFilters totalCount={filtered.length} />
      </div>

      {/* Company cards */}
      <div className="space-y-4">
        {filtered.map((view) => (
          <OptOutCompanyCard
            key={view.company.slug}
            view={view}
            userName={userName}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No companies match the current filters.</p>
        </div>
      )}
    </>
  );
}
