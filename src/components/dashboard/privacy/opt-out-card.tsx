"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmationDialog } from "@/components/dashboard/confirmation-dialog";

interface OptOutCardProps {
  optedOut: boolean;
}

export function OptOutCard({ optedOut: initialOptedOut }: OptOutCardProps) {
  const [optedOut, setOptedOut] = useState(initialOptedOut);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);

  const handleToggle = (checked: boolean) => {
    setPendingValue(checked);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard/opt-out", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setOptedOut(data.opted_out);
    }
    setLoading(false);
    setShowConfirm(false);
  };

  return (
    <>
      <Card className="border-border/50 bg-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">AI Training Participation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {optedOut ? "You've opted out" : "You're opted in"}
              </p>
              <p className="text-xs text-muted-foreground">
                {optedOut
                  ? "Your photos won't be used in future training batches."
                  : "Your photos are being used for ethical AI training."}
              </p>
            </div>
            <Switch
              checked={!optedOut}
              onCheckedChange={(checked) => handleToggle(!checked)}
            />
          </div>
          {optedOut && (
            <p className="text-xs text-secondary mt-3 pt-3 border-t border-border/30">
              You can opt back in anytime. Previously trained models cannot be
              un-trained, but your photos will be included in future batches.
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={pendingValue ? "Opt Out of AI Training" : "Opt Back In"}
        description={
          pendingValue
            ? "Your photos will be removed from future training batches. Existing trained models cannot be un-trained. You can opt back in anytime."
            : "Your photos will be included in future AI training batches again."
        }
        confirmLabel={pendingValue ? "Opt Out" : "Opt Back In"}
        variant={pendingValue ? "destructive" : "default"}
        onConfirm={handleConfirm}
        loading={loading}
      />
    </>
  );
}
