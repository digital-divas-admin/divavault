"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";

const presets = [
  {
    label: "Quality issue",
    text: "Thanks for submitting! The images didn't quite meet the resolution requirements for this request. Feel free to reshoot and resubmit \u2014 we'd love to see more from you.",
  },
  {
    label: "Relevance issue",
    text: "We appreciate your submission! The images didn't quite match what we were looking for here. Check the guidelines and feel free to try again, or browse other requests.",
  },
  {
    label: "Encouraging revision",
    text: "Your photos show great potential. This batch needed a few tweaks \u2014 see the notes below. You're welcome to resubmit after adjustments.",
  },
  {
    label: "Already fulfilled",
    text: "Thank you for your time. We've reached the needed quantity for this request. Keep an eye on new requests \u2014 your contributions are valued.",
  },
];

interface ReviewFeedbackFormProps {
  submissionId: string;
}

export function ReviewFeedbackForm({ submissionId }: ReviewFeedbackFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qualityBonus, setQualityBonus] = useState(false);

  async function handleReview(action: "accept" | "reject" | "revision_requested") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          feedback: feedback || undefined,
          awardQualityBonus: action === "accept" ? qualityBonus : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Review failed");
      }
      setConfirmAction(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2 rounded-lg bg-destructive/10 text-sm text-destructive">
          {error}
        </div>
      )}
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setFeedback(p.text)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Add feedback for the contributor (optional for accept)..."
        rows={3}
        className="text-sm"
      />

      <div className="flex items-center gap-2">
        {/* Accept */}
        <Dialog
          open={confirmAction === "accept"}
          onOpenChange={(open) => setConfirmAction(open ? "accept" : null)}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Accept
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accept this submission?</DialogTitle>
              <DialogDescription>
                The contributor will be paid and the submission will count toward fulfillment.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 py-2">
              <Switch
                id="quality-bonus"
                checked={qualityBonus}
                onCheckedChange={setQualityBonus}
              />
              <label htmlFor="quality-bonus" className="text-sm">
                Award quality bonus
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleReview("accept")}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Accept
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Revision */}
        <Button
          size="sm"
          variant="outline"
          className="text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
          onClick={() => handleReview("revision_requested")}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Request Revision
        </Button>

        {/* Reject */}
        <Dialog
          open={confirmAction === "reject"}
          onOpenChange={(open) => setConfirmAction(open ? "reject" : null)}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject this submission?</DialogTitle>
              <DialogDescription>
                The contributor will be notified with your feedback.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => handleReview("reject")}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
