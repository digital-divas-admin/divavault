"use client";

import { useCallback, useState } from "react";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { StepContainer } from "./step-container";
import { QRHandoff } from "./qr-handoff";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Monitor,
} from "lucide-react";

function useIsMobile() {
  const [isMobile] = useState(() => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  });
  return isMobile;
}

export function IdentityVerification() {
  const { verificationStatus, setVerificationStatus, setStep } = useOnboardingStore();
  const [loading, setLoading] = useState(false);
  const [showDesktopFlow, setShowDesktopFlow] = useState(false);
  const isMobile = useIsMobile();

  const launchVeriff = useCallback(async () => {
    setLoading(true);
    setVerificationStatus("pending");

    try {
      // Create a Veriff session via our API
      const res = await fetch("/api/veriff/session", { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to create verification session");
      }
      const { sessionUrl } = await res.json();

      // Dynamically import Veriff InContext SDK to avoid SSR issues
      const { createVeriffFrame, MESSAGES } = await import(
        "@veriff/incontext-sdk"
      );

      createVeriffFrame({
        url: sessionUrl,
        onEvent: (msg: string) => {
          if (msg === MESSAGES.STARTED) {
            setLoading(false);
          } else if (msg === MESSAGES.FINISHED) {
            // User completed the flow — waiting for webhook decision
            setVerificationStatus("pending");
          } else if (msg === MESSAGES.CANCELED) {
            // User cancelled — allow retry
            setVerificationStatus(null as unknown as "pending");
            // Reset to no status so user can start again
            useOnboardingStore.setState({ verificationStatus: null });
          }
        },
      });
    } catch (err) {
      console.error("Veriff launch error:", err);
      setVerificationStatus("red");
      setLoading(false);
    }
  }, [setVerificationStatus]);

  // On desktop, show QR handoff first
  const showQR = !isMobile && !showDesktopFlow && !verificationStatus;

  return (
    <StepContainer
      title="Verify Your Identity"
      description="This step makes sure nobody can upload photos of someone else. It protects you — and every other contributor."
    >
      {showQR && (
        <div className="mb-8">
          <QRHandoff onContinueOnDesktop={() => setShowDesktopFlow(true)} />
        </div>
      )}

      {(isMobile || showDesktopFlow || verificationStatus) && (
        <Card className="border-border/50 bg-card rounded-2xl mb-8">
          <CardContent className="p-5 sm:p-8 text-center">
            {!verificationStatus && !loading && (
              <>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                  Let&apos;s Verify It&apos;s Really You
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  We use Veriff, a regulated identity verification provider, to
                  confirm your identity. This takes about 2 minutes and requires a
                  government-issued ID. Veriff handles your ID data directly — we
                  never see or store your ID document.
                </p>
                {!isMobile && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Continuing on desktop</span>
                  </div>
                )}
                <Button onClick={launchVeriff}>Start Verification</Button>
                {process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS !== "false" && (
                  <div className="mt-4 pt-4 border-t border-dashed border-amber-300">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setVerificationStatus("pending");
                        // Also update the DB so /api/onboarding/complete passes
                        const { createClient } = await import("@/lib/supabase/client");
                        const supabase = createClient();
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          await supabase.from("contributors").upsert(
                            { id: user.id, email: user.email ?? "", verification_status: "green" },
                            { onConflict: "id" }
                          );
                        }
                        setVerificationStatus("green");
                        setLoading(false);
                      }}
                      className="text-xs text-amber-600 underline underline-offset-2 hover:text-amber-800"
                    >
                      [DEV] Skip verification
                    </button>
                  </div>
                )}
              </>
            )}

            {loading && !verificationStatus && (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-6" />
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                  Loading Verification...
                </h3>
                <p className="text-sm text-muted-foreground">
                  The identity verification form is loading. This usually takes a few seconds.
                </p>
              </>
            )}

            {verificationStatus === "pending" && (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-6" />
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                  Checking Your Identity...
                </h3>
                <p className="text-sm text-muted-foreground">
                  This usually takes under a minute. Your ID data is processed
                  securely by Veriff and not stored on our servers.
                </p>
              </>
            )}

            {verificationStatus === "green" && (
              <>
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-6" />
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                  You&apos;re Verified
                </h3>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  Verified
                </Badge>
                <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
                  Your identity is confirmed. Your ID document was processed by
                  Veriff and is not stored by Consented AI.
                </p>
              </>
            )}

            {verificationStatus === "red" && (
              <>
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-6" />
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                  Verification Didn&apos;t Go Through
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  This happens sometimes — it could be a blurry photo or a
                  lighting issue. Your data from this attempt is not retained. You
                  can try again whenever you&apos;re ready.
                </p>
                <Button onClick={launchVeriff} variant="outline">
                  Try Again
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => setStep(2)}
          disabled={verificationStatus !== "green"}
        >
          Continue
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </StepContainer>
  );
}
