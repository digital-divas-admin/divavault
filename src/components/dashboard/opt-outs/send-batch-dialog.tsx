"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, AlertTriangle, Loader2, Mail } from "lucide-react";
import type { AICompany } from "@/types/optout";

interface SendBatchDialogProps {
  companies: AICompany[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendBatch: () => void;
}

export function SendBatchDialog({
  companies,
  open,
  onOpenChange,
  onSendBatch,
}: SendBatchDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleSendBatch() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/opt-outs/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_slugs: companies.map((c) => c.slug),
        }),
      });
      if (res.ok) {
        onSendBatch();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to All Email Companies</DialogTitle>
          <DialogDescription>
            {companies.length} {companies.length === 1 ? "company" : "companies"}{" "}
            will receive formal opt-out notices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Company list */}
          <div className="rounded-lg border border-border/50 bg-secondary/30 divide-y divide-border/30 max-h-[240px] overflow-y-auto">
            {companies.map((company) => (
              <div
                key={company.slug}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {company.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {company.contactEmail || "No email available"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500/90 leading-relaxed">
              This sends formal legal notices. Emails will be sent from
              legal@consentedai.com with your name.
            </p>
          </div>

          {/* Delivery note */}
          <p className="text-xs text-muted-foreground">
            Emails will be sent with a brief delay between each to ensure
            delivery.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSendBatch} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {loading ? "Sending..." : `Send All (${companies.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
