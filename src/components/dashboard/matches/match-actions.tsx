"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TierGate } from "@/components/dashboard/matches/tier-gate";
import { FileWarning, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface MatchActionsProps {
  matchId: string;
  currentStatus: string;
  canRequestTakedown: boolean;
  hasPendingTakedown: boolean;
}

const DISMISS_REASONS = [
  { value: "my_account", label: "My account" },
  { value: "not_me", label: "Not me" },
  { value: "authorized_use", label: "Authorized use" },
  { value: "other", label: "Other" },
] as const;

export function MatchActions({
  matchId,
  currentStatus,
  canRequestTakedown,
  hasPendingTakedown,
}: MatchActionsProps) {
  const router = useRouter();
  const [reviewLoading, setReviewLoading] = useState(false);
  const [takedownLoading, setTakedownLoading] = useState(false);
  const [dismissLoading, setDismissLoading] = useState(false);
  const [dismissReason, setDismissReason] = useState<string>("not_me");
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);

  async function handleMarkReviewed() {
    setReviewLoading(true);
    try {
      await fetch(`/api/dashboard/matches/${matchId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });
      router.refresh();
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleRequestTakedown() {
    setTakedownLoading(true);
    try {
      await fetch(`/api/dashboard/matches/${matchId}/takedown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takedown_type: "dmca" }),
      });
      setTakedownOpen(false);
      router.refresh();
    } finally {
      setTakedownLoading(false);
    }
  }

  async function handleDismiss() {
    setDismissLoading(true);
    try {
      await fetch(`/api/dashboard/matches/${matchId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: dismissReason }),
      });
      setDismissOpen(false);
      router.refresh();
    } finally {
      setDismissLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Request Takedown */}
      {canRequestTakedown ? (
        <Dialog open={takedownOpen} onOpenChange={setTakedownOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={hasPendingTakedown || currentStatus === "removed" || currentStatus === "dismissed"}
              className="gap-2"
            >
              <FileWarning className="w-4 h-4" />
              Request DMCA Takedown
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request DMCA Takedown</DialogTitle>
              <DialogDescription>
                This will file a DMCA takedown request with the platform. The platform will
                be notified and the content will be reviewed for removal. This process
                typically takes 3-10 business days.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTakedownOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRequestTakedown} disabled={takedownLoading}>
                {takedownLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Takedown
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <TierGate feature="takedown requests" canAccess={false}>
          <span />
        </TierGate>
      )}

      {/* Mark Reviewed */}
      {currentStatus === "new" && (
        <Button
          variant="secondary"
          onClick={handleMarkReviewed}
          disabled={reviewLoading}
          className="gap-2"
        >
          {reviewLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Mark Reviewed
        </Button>
      )}

      {/* Dismiss */}
      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            disabled={currentStatus === "dismissed"}
            className="gap-2"
          >
            <XCircle className="w-4 h-4" />
            Dismiss
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Match</DialogTitle>
            <DialogDescription>
              Select a reason for dismissing this match.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {DISMISS_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setDismissReason(r.value)}
                className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                  dismissReason === r.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDismiss} disabled={dismissLoading}>
              {dismissLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Dismiss Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
