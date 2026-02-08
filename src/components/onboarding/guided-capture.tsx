"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { createClient } from "@/lib/supabase/client";
import { StepContainer } from "./step-container";
import { CameraView, type CameraViewHandle } from "./capture/camera-view";
import { CaptureButton } from "./capture/capture-button";
import { QualityFeedback } from "./capture/quality-feedback";
import { StepIndicator } from "./capture/step-indicator";
import { PoseGuide } from "./capture/pose-guide";
import { QRHandoff } from "./qr-handoff";
import { PhotoGuidelines } from "./photo-guidelines";
import { InstagramConnect } from "./instagram-connect";
import { PhotoUpload } from "./photo-upload";
import { PhotoGallery } from "./photo-gallery";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { CAPTURE_STEPS, MIN_CAPTURE_STEPS } from "@/lib/capture-steps";
import { runQualityChecks } from "@/lib/quality-checks";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { QualityCheckResult } from "@/types/capture";

export function GuidedCapture() {
  const {
    setStep,
    capturedSteps,
    addCapturedStep,
    captureSessionId,
    setCaptureSessionId,
    setCaptureCompleted,
    useFallbackUpload,
    setUseFallbackUpload,
    totalPhotoCount,
  } = useOnboardingStore();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qualityChecks, setQualityChecks] = useState<QualityCheckResult[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const cameraRef = useRef<CameraViewHandle>(null);
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = CAPTURE_STEPS[currentStepIndex];
  const allChecksPass = qualityChecks.length > 0 && qualityChecks.every((c) => c.passed);
  const captureComplete = capturedSteps.length >= MIN_CAPTURE_STEPS;

  // Create capture session on mount (only when not in fallback mode)
  useEffect(() => {
    if (captureSessionId || useFallbackUpload) return;

    async function createSession() {
      try {
        const res = await fetch("/api/capture/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionType: "onboarding",
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              screenWidth: window.screen.width,
              screenHeight: window.screen.height,
              cameraFacing: "user",
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setCaptureSessionId(data.sessionId);
        }
      } catch (err) {
        console.error("Failed to create capture session:", err);
      }
    }

    createSession();
  }, [captureSessionId, setCaptureSessionId, useFallbackUpload]);

  // Run quality checks periodically (only when camera is active)
  useEffect(() => {
    if (!cameraReady || !currentStep || useFallbackUpload) return;

    function runChecks() {
      const canvas = cameraRef.current?.getCanvas();
      const { width, height } = cameraRef.current?.getVideoSize() || {
        width: 0,
        height: 0,
      };

      if (canvas && width > 0 && height > 0) {
        const results = runQualityChecks({
          checks: currentStep.requiredChecks,
          canvas,
          videoWidth: width,
          videoHeight: height,
        });
        setQualityChecks(results);
      }
    }

    qualityIntervalRef.current = setInterval(runChecks, 500);

    return () => {
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
      }
    };
  }, [cameraReady, currentStep, useFallbackUpload]);

  const handleCapture = useCallback(async () => {
    if (!allChecksPass || capturing || !captureSessionId || !currentStep) return;

    setCapturing(true);
    setError(null);

    try {
      const blob = cameraRef.current?.captureFrame();
      if (!blob) {
        setError("Failed to capture image. Please try again.");
        setCapturing(false);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Authentication error. Please refresh the page.");
        setCapturing(false);
        return;
      }

      const timestamp = Date.now();
      const fileName = `${user.id}/${captureSessionId}/${currentStep.id}-${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("capture-uploads")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        setError("Failed to upload photo. Please try again.");
        setCapturing(false);
        return;
      }

      const brightnessCheck = qualityChecks.find((c) => c.type === "brightness");
      const sharpnessCheck = qualityChecks.find((c) => c.type === "sharpness");

      await fetch("/api/capture/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: captureSessionId,
          captureStep: currentStep.id,
          filePath: fileName,
          bucket: "capture-uploads",
          fileSize: blob.size,
          brightnessScore: brightnessCheck?.value,
          sharpnessScore: sharpnessCheck?.value,
        }),
      });

      addCapturedStep(currentStep.id);

      if (currentStepIndex < CAPTURE_STEPS.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        setQualityChecks([]);
      }
    } catch (err) {
      console.error("Capture error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setCapturing(false);
    }
  }, [
    allChecksPass,
    capturing,
    captureSessionId,
    currentStep,
    currentStepIndex,
    qualityChecks,
    addCapturedStep,
  ]);

  async function handleComplete() {
    if (!captureSessionId) return;
    setUploading(true);

    try {
      await fetch("/api/capture/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: captureSessionId,
          status: "completed",
          imagesCaptured: capturedSteps.length,
        }),
      });

      setCaptureCompleted(true);
      setStep(5);
    } catch {
      setError("Failed to finalize. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // Fallback upload handlers
  const fallbackCount = totalPhotoCount();
  const fallbackHasEnough = fallbackCount >= 25;

  async function handleFallbackContinue() {
    setCompleting(true);
    try {
      const res = await fetch("/api/capture/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionType: "onboarding" }),
      });

      if (res.ok) {
        const { sessionId } = await res.json();
        await fetch("/api/capture/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            status: "completed",
            imagesCaptured: fallbackCount,
          }),
        });
      }

      setCaptureCompleted(true);
      setStep(5);
    } catch {
      setCompleting(false);
    }
  }

  // Render fallback upload mode
  if (useFallbackUpload) {
    return (
      <StepContainer
        title="Upload Your Photos"
        description="Upload at least 25 photos from your device. Choose photos you're comfortable sharing."
      >
        <div className="text-center mb-4">
          <button
            onClick={() => setUseFallbackUpload(false)}
            className="text-xs text-primary underline underline-offset-2"
          >
            Switch back to guided camera capture
          </button>
        </div>

        <div className="space-y-6 mb-8">
          <PhotoGuidelines />
          <InstagramConnect />
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              or upload from your device
            </span>
            <Separator className="flex-1" />
          </div>
          <PhotoUpload />
          <PhotoGallery />
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(3)}>
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back
          </Button>
          <Button onClick={handleFallbackContinue} disabled={!fallbackHasEnough || completing}>
            {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </StepContainer>
    );
  }

  // Render guided capture mode
  return (
    <StepContainer
      title="Capture Your Photos"
      description="We'll guide you through each pose. Make sure you're in a well-lit area."
    >
      {cameraError ? (
        <div className="space-y-4 mb-6">
          <QRHandoff
            variant="capture"
            step={4}
            onContinueOnDesktop={() => setUseFallbackUpload(true)}
          />
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setUseFallbackUpload(true)}
            >
              <Upload className="mr-2 w-4 h-4" />
              Upload Photos Instead
            </Button>
          </div>
        </div>
      ) : captureComplete ? (
        <Card className="border-primary/20 bg-primary/5 rounded-2xl mb-6">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
              Photos Captured!
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              You&apos;ve captured {capturedSteps.length} photos.
              {capturedSteps.length < CAPTURE_STEPS.length &&
                ` You can capture ${CAPTURE_STEPS.length - capturedSteps.length} more optional poses.`}
            </p>
            {capturedSteps.length < CAPTURE_STEPS.length && (
              <Button
                variant="outline"
                size="sm"
                className="mb-4"
                onClick={() => {
                  const nextIndex = CAPTURE_STEPS.findIndex(
                    (s) => !capturedSteps.includes(s.id)
                  );
                  if (nextIndex >= 0) setCurrentStepIndex(nextIndex);
                }}
              >
                Capture More Photos
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {currentStep && (
            <StepIndicator
              currentIndex={currentStepIndex}
              totalSteps={CAPTURE_STEPS.length}
              label={currentStep.label}
              instruction={currentStep.instruction}
            />
          )}

          <div className="relative mb-4">
            <CameraView
              ref={cameraRef}
              onReady={() => setCameraReady(true)}
              onError={(err) => setCameraError(err)}
            />
            {currentStep && <PoseGuide type={currentStep.poseGuide} />}
            <QualityFeedback checks={qualityChecks} />
          </div>

          <div className="flex justify-center mb-4">
            <CaptureButton
              disabled={!cameraReady || capturing}
              ready={allChecksPass}
              onClick={handleCapture}
            />
          </div>

          <p className="text-xs text-center text-muted-foreground mb-2">
            {capturedSteps.length} of {MIN_CAPTURE_STEPS} minimum photos captured
          </p>
        </>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-sm mb-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {!cameraError && !captureComplete && (
        <div className="text-center mb-4">
          <button
            onClick={() => setUseFallbackUpload(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary"
          >
            Can&apos;t use camera? Upload photos instead
          </button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(3)}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
        {captureComplete ? (
          <Button onClick={handleComplete} disabled={uploading}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        ) : (
          <Button disabled>
            {MIN_CAPTURE_STEPS - capturedSteps.length} more needed
          </Button>
        )}
      </div>
    </StepContainer>
  );
}
