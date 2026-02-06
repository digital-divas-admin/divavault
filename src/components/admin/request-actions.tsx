"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BountyRequest } from "@/types/marketplace";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pause, Play, XCircle } from "lucide-react";

interface RequestActionsProps {
  request: BountyRequest;
}

export function RequestActions({ request }: RequestActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function performAction(action: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }
      setConfirmAction(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  const canPause = request.status === "published";
  const canUnpause = request.status === "paused";
  const canClose =
    request.status === "published" || request.status === "paused";

  if (!canPause && !canUnpause && !canClose) return null;

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-3">
      {canPause && (
        <Button
          variant="outline"
          onClick={() => performAction("pause")}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Pause className="h-4 w-4 mr-2" />
          )}
          Pause Request
        </Button>
      )}

      {canUnpause && (
        <Button
          variant="outline"
          onClick={() => performAction("unpause")}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Resume Request
        </Button>
      )}

      {canClose && (
        <Dialog
          open={confirmAction === "close"}
          onOpenChange={(open) => setConfirmAction(open ? "close" : null)}
        >
          <DialogTrigger asChild>
            <Button variant="destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Close Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close this request?</DialogTitle>
              <DialogDescription>
                This will remove the request from the marketplace. Contributors
                will no longer be able to submit. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => performAction("close")}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Close Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
