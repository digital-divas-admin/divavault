"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Ban, ShieldOff, Flag, FlagOff } from "lucide-react";

interface UserActionsProps {
  userId: string;
  suspended: boolean;
  flagged: boolean;
  flagReason: string | null;
}

export function UserActions({ userId, suspended, flagged, flagReason }: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [reason, setReason] = useState(flagReason || "");

  async function performAction(action: string, body?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }
      setConfirmAction(null);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Suspend / Unsuspend */}
        <Dialog
          open={confirmAction === "suspend"}
          onOpenChange={(open) => setConfirmAction(open ? "suspend" : null)}
        >
          <DialogTrigger asChild>
            <Button variant={suspended ? "outline" : "destructive"} size="sm">
              {suspended ? (
                <>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Unsuspend
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Suspend
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {suspended ? "Unsuspend this user?" : "Suspend this user?"}
              </DialogTitle>
              <DialogDescription>
                {suspended
                  ? "The user will regain access to the platform."
                  : "The user will be blocked from accessing the platform."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                variant={suspended ? "default" : "destructive"}
                onClick={() => performAction(suspended ? "unsuspend" : "suspend")}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {suspended ? "Unsuspend" : "Suspend"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Flag / Unflag */}
        <Dialog
          open={confirmAction === "flag"}
          onOpenChange={(open) => {
            setConfirmAction(open ? "flag" : null);
            if (!open) setReason(flagReason || "");
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              {flagged ? (
                <>
                  <FlagOff className="h-4 w-4 mr-2" />
                  Unflag
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Flag
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {flagged ? "Remove flag from this user?" : "Flag this user?"}
              </DialogTitle>
              <DialogDescription>
                {flagged
                  ? "The flag and reason will be cleared."
                  : "Add a reason for flagging this user for review."}
              </DialogDescription>
            </DialogHeader>
            {!flagged && (
              <div className="space-y-2">
                <Label htmlFor="flag-reason">Reason</Label>
                <Textarea
                  id="flag-reason"
                  placeholder="Why is this user being flagged?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  performAction(flagged ? "unflag" : "flag", { reason })
                }
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {flagged ? "Remove Flag" : "Flag User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
