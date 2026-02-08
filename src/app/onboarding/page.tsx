"use client";

import { Suspense, useEffect, useRef } from "react";
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
        }
      } catch {
        // Ignore — user stays on current step
      }
    }

    validateHandoff(handoffToken);
  }, [searchParams, setStep, setSumsubStatus]);

  return (
    <div>
      <ProgressBar currentStep={currentStep} />

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
