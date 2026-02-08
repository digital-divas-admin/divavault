"use client";

import { useOnboardingStore } from "@/stores/onboarding-store";
import { StepContainer } from "./step-container";
import { PhotoGuidelines } from "./photo-guidelines";
import { InstagramConnect } from "./instagram-connect";
import { PhotoUpload } from "./photo-upload";
import { PhotoGallery } from "./photo-gallery";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight } from "lucide-react";

const MIN_PHOTOS = 25;

export function DataContribution() {
  const { setStep, totalPhotoCount } = useOnboardingStore();
  const count = totalPhotoCount();
  const hasEnough = count >= MIN_PHOTOS;

  return (
    <StepContainer
      title="Add Your Photos"
      description="Choose photos you're comfortable sharing. You pick each one — nothing is auto-selected. Minimum 25 photos to train the AI model effectively."
    >
      <div className="space-y-6 mb-8">
        {/* Photo Guidelines */}
        <PhotoGuidelines />

        {/* Instagram Connect */}
        <InstagramConnect />

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            or upload from your device
          </span>
          <Separator className="flex-1" />
        </div>

        {/* Manual Upload */}
        <PhotoUpload />

        {/* Photo Gallery / Preview */}
        <PhotoGallery />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={() => setStep(3)}
          disabled={!hasEnough}
        >
          Continue
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </StepContainer>
  );
}
