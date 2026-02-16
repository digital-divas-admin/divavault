"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Mail, Globe, Loader2 } from "lucide-react";
import { OptOutCompanyCard } from "@/components/dashboard/opt-outs/optout-company-card";
import { SendBatchDialog } from "@/components/dashboard/opt-outs/send-batch-dialog";
import type { OptOutCompanyView, OptOutStats } from "@/types/optout";

interface OptOutPageClientProps {
  views: OptOutCompanyView[];
  stats: OptOutStats;
  userName: string;
}

export function OptOutPageClient({
  views,
  userName,
}: OptOutPageClientProps) {
  const router = useRouter();
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const handleUpdate = () => router.refresh();

  // Split into two groups
  const emailCompanies = views.filter(
    (v) => v.company.method === "email" || v.company.method === "none"
  );
  const selfServiceCompanies = views.filter(
    (v) =>
      v.company.method === "web_form" ||
      v.company.method === "account_settings"
  );

  // Companies eligible for batch send (email-based, not yet contacted)
  const batchEligible = emailCompanies
    .filter(
      (v) =>
        v.company.contactEmail &&
        (!v.request || v.request.status === "not_started")
    )
    .map((v) => v.company);

  // Sort: not started first, then in-progress, then completed
  const statusOrder: Record<string, number> = {
    not_started: 0,
    sent: 1,
    follow_up_sent: 1,
    unresponsive: 2,
    denied: 2,
    confirmed: 3,
    completed_web: 3,
    completed_settings: 3,
  };

  function sortByStatus(a: OptOutCompanyView, b: OptOutCompanyView) {
    const aOrder = statusOrder[a.request?.status || "not_started"] ?? 0;
    const bOrder = statusOrder[b.request?.status || "not_started"] ?? 0;
    return aOrder - bOrder;
  }

  const sortedEmail = [...emailCompanies].sort(sortByStatus);
  const sortedSelfService = [...selfServiceCompanies].sort(sortByStatus);

  const handleBatchSend = async () => {
    setBatchLoading(true);
    try {
      await fetch("/api/dashboard/opt-outs/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      router.refresh();
    } finally {
      setBatchLoading(false);
      setBatchOpen(false);
    }
  };

  const emailCompleted = emailCompanies.filter(
    (v) =>
      v.request?.status === "confirmed" ||
      v.request?.status === "completed_web" ||
      v.request?.status === "completed_settings"
  ).length;
  const selfServiceCompleted = selfServiceCompanies.filter(
    (v) =>
      v.request?.status === "completed_web" ||
      v.request?.status === "completed_settings" ||
      v.request?.status === "confirmed"
  ).length;

  return (
    <>
      {/* ================= SECTION 1: EMAIL ================= */}
      <section className="mb-10">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold">
              We&apos;ll Send For You
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {emailCompleted}/{emailCompanies.length} done
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We send a formal legal notice citing CCPA, BIPA, and GDPR to these
            companies on your behalf. If they don&apos;t respond within 30 days,
            we automatically follow up.
          </p>
        </div>

        {/* Batch CTA */}
        {batchEligible.length > 0 && (
          <div className="flex items-center justify-between p-4 mb-4 rounded-xl border border-primary/20 bg-primary/5">
            <div>
              <p className="text-sm font-medium">
                Send to all {batchEligible.length} companies at once
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                One click sends formal opt-out notices to every email-based
                company
              </p>
            </div>
            <Button
              onClick={() => setBatchOpen(true)}
              disabled={batchLoading}
              className="shrink-0 gap-2"
            >
              {batchLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to All ({batchEligible.length})
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {sortedEmail.map((view) => (
            <OptOutCompanyCard
              key={view.company.slug}
              view={view}
              userName={userName}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </section>

      {/* ============= SECTION 2: SELF-SERVICE ============= */}
      <section>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold">
              Complete These Yourself
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {selfServiceCompleted}/{selfServiceCompanies.length} done
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These companies let you opt out through their website or account
            settings. Follow the steps for each, then mark it as done to add it
            to your evidence trail.
          </p>
        </div>

        <div className="space-y-3">
          {sortedSelfService.map((view) => (
            <OptOutCompanyCard
              key={view.company.slug}
              view={view}
              userName={userName}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </section>

      {/* Batch dialog */}
      <SendBatchDialog
        companies={batchEligible}
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onSendBatch={handleBatchSend}
      />
    </>
  );
}
