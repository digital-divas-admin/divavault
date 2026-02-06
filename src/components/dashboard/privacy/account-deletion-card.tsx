"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AccountDeletionCardProps {
  deletionScheduledFor: string | null;
}

export function AccountDeletionCard({
  deletionScheduledFor,
}: AccountDeletionCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [scheduled, setScheduled] = useState(deletionScheduledFor);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setLoading(true);
    const res = await fetch("/api/dashboard/account/delete", {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      setScheduled(data.scheduled_for);
    }
    setLoading(false);
    setShowDialog(false);
    setConfirmText("");
  };

  if (scheduled) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Account Deletion Scheduled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your account and all associated data will be permanently deleted on{" "}
            <strong>
              {new Date(scheduled).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </strong>
            . Contact support if you change your mind.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-destructive/20 bg-card/50 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Delete Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Permanently delete your account and all associated data. This
            includes your profile, uploaded photos, and consent records. There is
            a 30-day cooling period before deletion is final.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDialog(true)}
          >
            Request Account Deletion
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Your Account</DialogTitle>
            <DialogDescription>
              This action cannot be easily undone. Your account will be scheduled
              for deletion in 30 days.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              All your photos, profile data, consent records, and activity
              history will be permanently deleted.
            </AlertDescription>
          </Alert>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Type <strong>DELETE</strong> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || loading}
            >
              {loading ? "Processing..." : "Schedule Deletion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
