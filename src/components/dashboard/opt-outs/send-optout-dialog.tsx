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
import { Send, AlertTriangle, Loader2 } from "lucide-react";
import type { AICompany } from "@/types/optout";

interface SendOptOutDialogProps {
  company: AICompany;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: () => void;
}

export function SendOptOutDialog({
  company,
  userName,
  open,
  onOpenChange,
  onSend,
}: SendOptOutDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/opt-outs/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_slug: company.slug }),
      });
      if (res.ok) {
        onSend();
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
          <DialogTitle>Send Opt-Out Notice</DialogTitle>
          <DialogDescription>
            This will send a formal legal notice to {company.name} on your
            behalf.
          </DialogDescription>
        </DialogHeader>

        {/* Notice preview */}
        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">From:</span>
              <span className="text-foreground font-medium">{userName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">To:</span>
              <span className="text-foreground font-medium">
                {company.contactEmail || "N/A"}
              </span>
            </div>
            <div className="border-t border-border/30 pt-2.5 space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                References
              </p>
              <p className="text-sm text-foreground">
                CCPA, BIPA, GDPR Article 21
              </p>
            </div>
            <div className="border-t border-border/30 pt-2.5 space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Requests
              </p>
              <p className="text-sm text-foreground">
                Data deletion, exclusion from training, 30-day response deadline
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500/90 leading-relaxed">
              This sends a formal legal notice. The email will be sent from
              legal@consentedai.com with your name.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {loading ? "Sending..." : "Send Notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
