"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Banknote, Loader2 } from "lucide-react";

interface BatchPayoutButtonProps {
  pendingCount: number;
  pendingAmount: string;
}

export function BatchPayoutButton({
  pendingCount,
  pendingAmount,
}: BatchPayoutButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handlePayout = async () => {
    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/payouts/batch", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: `Batch sent: ${data.itemCount} items totaling $${(data.totalAmount / 100).toFixed(2)}${data.skippedNoPaypal > 0 ? ` (${data.skippedNoPaypal} skipped — no PayPal email)` : ""}`,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to process batch payout",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Network error — please try again",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={pendingCount === 0 || processing}>
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Banknote className="h-4 w-4 mr-2" />
                Process Payouts ({pendingCount})
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Payout</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a PayPal batch payout for{" "}
              <strong>{pendingCount} pending earnings</strong> totaling{" "}
              <strong>{pendingAmount}</strong>. Contributors without a PayPal
              email on file will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePayout}>
              Send Payouts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <p
          className={`text-sm ${result.success ? "text-green-600" : "text-red-600"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
