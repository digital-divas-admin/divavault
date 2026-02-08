"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { IdentityVerification } from "@/components/onboarding/identity-verification";
import { ProfileBuilder } from "@/components/onboarding/profile-builder";
import { ConsentConfiguration } from "@/components/onboarding/consent-configuration";
import { GuidedCapture } from "@/components/onboarding/guided-capture";
import { OnboardingComplete } from "@/components/onboarding/onboarding-complete";

function OnboardingContent() {
  const { currentStep, setStep, setSumsubStatus } = useOnboardingStore();
  const searchParams = useSearchParams();
  const handoffProcessed = useRef(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  // Process handoff token from QR code — jump to the encoded step
  useEffect(() => {
    if (handoffProcessed.current) return;
    const handoffToken = searchParams.get("handoff");
    if (!handoffToken) return;

    handoffProcessed.current = true;

    async function validateHandoff(token: string) {
      try {
        const res = await fetch(`/api/onboarding/handoff?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.step) {
            // Mark prior steps as done so we skip them
            if (data.step >= 2) setSumsubStatus("green");
            setStep(data.step);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          setHandoffError(
            data.error === "Token expired"
              ? "This handoff link has expired. Please generate a new QR code."
              : "This handoff link is invalid. Please generate a new QR code."
          );
        }
      } catch {
        setHandoffError("Could not validate handoff link. Please try again.");
      }
    }

    validateHandoff(handoffToken);
  }, [searchParams, setStep, setSumsubStatus]);

  return (
    <div>
      <ProgressBar currentStep={currentStep} />

      {handoffError && (
        <div className="mx-auto max-w-xl mb-4 p-4 rounded-lg bg-destructive/10 text-sm">
          <p className="font-medium text-destructive mb-1">Handoff failed</p>
          <p className="text-destructive/80">{handoffError}</p>
          <button
            onClick={() => setHandoffError(null)}
            className="mt-2 text-xs text-destructive underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {currentStep === 1 && <IdentityVerification />}
      {currentStep === 2 && <ProfileBuilder />}
      {currentStep === 3 && <ConsentConfiguration />}
      {currentStep === 4 && <GuidedCapture />}
      {currentStep === 5 && <OnboardingComplete />}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}
