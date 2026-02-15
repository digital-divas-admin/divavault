"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { CameraView, type CameraViewHandle } from "@/components/onboarding/capture/camera-view";
import { CaptureButton } from "@/components/onboarding/capture/capture-button";
import { QualityFeedback } from "@/components/onboarding/capture/quality-feedback";
import { runQualityChecks } from "@/lib/quality-checks";
import type { QualityCheckResult } from "@/types/capture";
import { cn } from "@/lib/utils";
import { Upload, RotateCcw, Check } from "lucide-react";

interface SelfieCaptureProps {
  onCapture: (blob: Blob) => void;
}

export function SelfieCapture({ onCapture }: SelfieCaptureProps) {
  const cameraRef = useRef<CameraViewHandle>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qualityChecks, setQualityChecks] = useState<QualityCheckResult[]>([]);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const handleCameraError = useCallback((error: string) => {
    setCameraError(error);
  }, []);

  // Run quality checks every 500ms while camera is active
  useEffect(() => {
    if (!cameraReady || capturedBlob) return;

    intervalRef.current = setInterval(() => {
      const canvas = cameraRef.current?.getCanvas();
      if (!canvas) return;

      const results = runQualityChecks({
        checks: ["face_detected", "brightness", "sharpness"],
        canvas,
      });
      setQualityChecks(results);
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cameraReady, capturedBlob]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const allChecksPassed = qualityChecks.length > 0 && qualityChecks.every((c) => c.passed);

  const handleCapture = useCallback(() => {
    const blob = cameraRef.current?.captureFrame();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    setCapturedBlob(blob);
    setPreviewUrl(url);
  }, []);

  const handleRetake = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    setQualityChecks([]);
  }, [previewUrl]);

  const handleConfirm = useCallback(() => {
    if (capturedBlob) {
      onCapture(capturedBlob);
    }
  }, [capturedBlob, onCapture]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onCapture(file);
      }
    },
    [onCapture]
  );

  // Fallback: file upload when camera fails
  if (cameraError) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-1">{cameraError}</p>
          <p className="text-sm text-foreground font-medium mb-4">
            Upload a selfie instead
          </p>
          <label
            className={cn(
              "inline-flex items-center gap-2 cursor-pointer rounded-md px-4 py-2",
              "bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            )}
          >
            <Upload className="w-4 h-4" />
            Choose Photo
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    );
  }

  // Preview captured photo
  if (capturedBlob && previewUrl) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-full aspect-[3/4] max-h-[60vh] bg-black rounded-2xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Captured selfie"
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRetake}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 border border-border bg-card text-sm font-medium text-foreground hover:bg-card/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Retake
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Check className="w-4 h-4" />
            Use this photo
          </button>
        </div>
      </div>
    );
  }

  // Live camera view
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full">
        <CameraView
          ref={cameraRef}
          onReady={handleCameraReady}
          onError={handleCameraError}
        />
        <QualityFeedback checks={qualityChecks} />
      </div>
      <CaptureButton
        disabled={!cameraReady}
        ready={allChecksPassed}
        onClick={handleCapture}
      />
    </div>
  );
}
