"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CoverageSlotData } from "@/lib/coverage-queries";
import type { CaptureStepConfig } from "@/types/capture";

interface PhotoSlotProps {
  step: string;
  stepConfig: CaptureStepConfig;
  image: CoverageSlotData | undefined;
  points: number;
  onUpload: (step: string, file: File) => Promise<void>;
}

function SlotSilhouette({ type }: { type: string }) {
  return (
    <svg
      viewBox="0 0 300 400"
      className="w-12 h-12 opacity-25"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeDasharray="8 4"
    >
      {type === "face_oval" && (
        <ellipse cx="150" cy="160" rx="80" ry="100" />
      )}
      {type === "upper_body" && (
        <>
          <ellipse cx="150" cy="80" rx="45" ry="55" />
          <path d="M 70 160 Q 90 140 150 135 Q 210 140 230 160" />
          <path d="M 70 160 L 70 320 L 230 320 L 230 160" />
        </>
      )}
      {type === "full_body" && (
        <>
          <ellipse cx="150" cy="50" rx="30" ry="38" />
          <path d="M 100 100 Q 110 88 150 85 Q 190 88 200 100" />
          <path d="M 100 100 L 100 240 L 200 240 L 200 100" />
          <path d="M 110 240 L 110 380" />
          <path d="M 190 240 L 190 380" />
        </>
      )}
    </svg>
  );
}

export function PhotoSlot({
  step,
  stepConfig,
  image,
  points,
  onUpload,
}: PhotoSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUpload(step, file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className="group relative aspect-square rounded-xl overflow-hidden border border-dashed border-border/60 bg-muted/10 transition-all hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none"
      >
        {image ? (
          <>
            <img
              src={image.signedUrl}
              alt={stepConfig.label}
              className="h-full w-full object-cover"
            />
            <div className="absolute top-1.5 right-1.5">
              <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow-md" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="h-5 w-5 text-white" />
              <span className="ml-1.5 text-xs font-medium text-white">
                Replace
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <>
                <SlotSilhouette type={stepConfig.poseGuide} />
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
                >
                  +{points} pts
                </Badge>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1.5">
                    <Upload className="h-3.5 w-3.5 text-white" />
                    <span className="text-xs font-medium text-white">
                      Upload
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </button>
      <span className="text-xs text-muted-foreground text-center truncate">
        {stepConfig.label}
      </span>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
