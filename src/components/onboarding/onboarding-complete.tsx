"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { StepContainer } from "./step-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, PartyPopper } from "lucide-react";
import { ProtectionScorePreview } from "./protection-score-preview";

export function OnboardingComplete() {
  const router = useRouter();
  const { reset, capturedSteps, totalPhotoCount } = useOnboardingStore();
  const [finalizing, setFinalizing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finalize() {
      try {
        const res = await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to finalize onboarding.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setFinalizing(false);
      }
    }

    finalize();
  }, []);

  function handleGoToDashboard() {
    reset();
    router.push("/dashboard");
  }

  if (finalizing) {
    return (
      <StepContainer
        title="Finalizing..."
        description="We're saving your onboarding data. This will just take a moment."
      >
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </StepContainer>
    );
  }

  if (error) {
    return (
      <StepContainer
        title="Something Went Wrong"
        description="We couldn't finalize your onboarding. Your progress is saved — you can try again."
      >
        <Card className="border-destructive/20 bg-destructive/5 rounded-2xl mb-6">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </StepContainer>
    );
  }

  const photoCount = capturedSteps.length + totalPhotoCount();

  return (
    <StepContainer
      title="You're All Set!"
      description="Welcome to Made Of Us. Your contribution helps build ethical AI that respects and compensates creators."
    >
      <Card className="border-primary/20 bg-primary/5 rounded-2xl mb-6">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <PartyPopper className="w-8 h-8 text-primary" />
          </div>

          <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold mb-4">
            Onboarding Complete
          </h3>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">ID Verified</p>
            </div>
            <div className="text-center">
              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Profile Built</p>
            </div>
            <div className="text-center">
              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                {photoCount} Photo{photoCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <ProtectionScorePreview />
          </div>

          <p className="text-sm text-muted-foreground mb-2">
            Your photos are being processed. You&apos;ll see them in your
            dashboard shortly.
          </p>
          <p className="text-xs text-muted-foreground">
            You can capture additional photos anytime from your dashboard.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleGoToDashboard} size="lg">
          Go to Dashboard
        </Button>
      </div>
    </StepContainer>
  );
}
