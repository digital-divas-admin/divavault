"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface ReviewFormProps {
  matchId: string;
  currentStatus: string;
}

export function ReviewForm({ matchId, currentStatus }: ReviewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isReviewed = currentStatus !== "pending";

  async function handleReview(status: "confirmed" | "dismissed" | "escalated") {
    setError(null);
    try {
      const res = await fetch(`/api/admin/ad-intel/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notes || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Review failed");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Network error");
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Review</h3>

      {isReviewed && (
        <p className="text-sm text-muted-foreground">
          This match has already been reviewed as{" "}
          <span className="font-medium text-foreground">{currentStatus}</span>.
          You can update the decision below.
        </p>
      )}

      <textarea
        className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        rows={3}
        placeholder="Reviewer notes (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={isPending}
      />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleReview("confirmed")}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Confirm
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleReview("dismissed")}
          disabled={isPending}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleReview("escalated")}
          disabled={isPending}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Escalate
        </Button>
      </div>
    </div>
  );
}
