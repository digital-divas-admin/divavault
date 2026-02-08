"use client";

import { useOnboardingStore } from "@/stores/onboarding-store";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { IdentityVerification } from "@/components/onboarding/identity-verification";
import { DataContribution } from "@/components/onboarding/data-contribution";
import { ConsentLegal } from "@/components/onboarding/consent-legal";

export default function OnboardingPage() {
  const { currentStep } = useOnboardingStore();

  return (
    <div>
      <ProgressBar currentStep={currentStep} />

      {currentStep === 1 && <IdentityVerification />}
      {currentStep === 2 && <DataContribution />}
      {currentStep === 3 && <ConsentLegal />}
    </div>
  );
}
