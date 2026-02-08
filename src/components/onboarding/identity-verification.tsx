"use client";

import { useOnboardingStore } from "@/stores/onboarding-store";
import { StepContainer } from "./step-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

export function IdentityVerification() {
  const { sumsubStatus, setSumsubStatus, setStep } = useOnboardingStore();

  // For MVP/dev: mock the verification flow
  function handleStartVerification() {
    setSumsubStatus("pending");
    // Simulate Sumsub verification completing after 2s
    setTimeout(() => {
      setSumsubStatus("green");
    }, 2000);
  }

  return (
    <StepContainer
      title="Verify Your Identity"
      description="This step makes sure nobody can upload photos of someone else. It protects you — and every other contributor."
    >
      <Card className="border-border/50 bg-card rounded-2xl mb-8">
        <CardContent className="p-5 sm:p-8 text-center">
          {!sumsubStatus && (
            <>
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                Let&apos;s Verify It&apos;s Really You
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                We use Sumsub, a regulated identity verification provider, to
                confirm your identity. This takes about 2 minutes and requires a
                government-issued ID. Sumsub handles your ID data directly — we
                never see or store your ID document.
              </p>
              <Button onClick={handleStartVerification}>
                Start Verification
              </Button>
            </>
          )}

          {sumsubStatus === "pending" && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-6" />
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                Checking Your Identity...
              </h3>
              <p className="text-sm text-muted-foreground">
                This usually takes under a minute. Your ID data is processed
                securely by Sumsub and not stored on our servers.
              </p>
            </>
          )}

          {sumsubStatus === "green" && (
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
                Sumsub and is not stored by Made Of Us.
              </p>
            </>
          )}

          {sumsubStatus === "red" && (
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
              <Button
                onClick={handleStartVerification}
                variant="outline"
              >
                Try Again
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => setStep(2)}
          disabled={sumsubStatus !== "green"}
        >
          Continue
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </StepContainer>
  );
}
