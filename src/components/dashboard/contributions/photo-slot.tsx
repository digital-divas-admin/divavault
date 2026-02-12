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

function SlotSilhouette({ step }: { step: string }) {
  const common = "w-16 h-16 opacity-30";

  // Face features shared across face steps: eyes, nose, mouth line
  const faceFeatures = (
    <>
      {/* Left eye */}
      <ellipse cx="120" cy="145" rx="12" ry="7" />
      {/* Right eye */}
      <ellipse cx="180" cy="145" rx="12" ry="7" />
      {/* Nose */}
      <path d="M 150 155 L 143 180 Q 150 185 157 180 Z" />
      {/* Mouth */}
      <path d="M 130 205 Q 150 215 170 205" />
    </>
  );

  // Front-facing head oval
  const headOval = <ellipse cx="150" cy="170" rx="75" ry="95" />;

  switch (step) {
    case "face_front":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {headOval}
          {faceFeatures}
          {/* Ears */}
          <path d="M 75 155 Q 65 170 75 185" />
          <path d="M 225 155 Q 235 170 225 185" />
          {/* Crosshair guides */}
          <line x1="150" y1="80" x2="150" y2="260" strokeDasharray="6 4" strokeWidth="1" opacity="0.4" />
          <line x1="80" y1="170" x2="220" y2="170" strokeDasharray="6 4" strokeWidth="1" opacity="0.4" />
        </svg>
      );

    case "face_left":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {/* Left-profile head shape */}
          <path d="M 190 75 Q 120 75 100 130 Q 85 170 95 210 Q 100 240 120 260 Q 140 275 170 270 Q 200 265 210 240 Q 220 200 220 170 Q 220 110 190 75 Z" />
          {/* Eye */}
          <ellipse cx="125" cy="150" rx="10" ry="6" />
          {/* Nose profile */}
          <path d="M 90 160 L 75 185 L 95 190" />
          {/* Mouth */}
          <path d="M 100 215 Q 120 222 140 215" />
          {/* Ear */}
          <path d="M 215 145 Q 230 165 215 185" />
          {/* Arrow hint */}
          <path d="M 60 170 L 40 170" strokeDasharray="4 3" strokeWidth="1.5" opacity="0.5" />
          <path d="M 46 164 L 40 170 L 46 176" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );

    case "face_right":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {/* Right-profile head shape (mirrored) */}
          <path d="M 110 75 Q 180 75 200 130 Q 215 170 205 210 Q 200 240 180 260 Q 160 275 130 270 Q 100 265 90 240 Q 80 200 80 170 Q 80 110 110 75 Z" />
          {/* Eye */}
          <ellipse cx="175" cy="150" rx="10" ry="6" />
          {/* Nose profile */}
          <path d="M 210 160 L 225 185 L 205 190" />
          {/* Mouth */}
          <path d="M 160 215 Q 180 222 200 215" />
          {/* Ear */}
          <path d="M 85 145 Q 70 165 85 185" />
          {/* Arrow hint */}
          <path d="M 240 170 L 260 170" strokeDasharray="4 3" strokeWidth="1.5" opacity="0.5" />
          <path d="M 254 164 L 260 170 L 254 176" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );

    case "face_up":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {/* Head tilted up — oval shifted down, slightly compressed vertically */}
          <ellipse cx="150" cy="180" rx="75" ry="88" />
          {/* Eyes — wider apart and slightly lower when looking up */}
          <ellipse cx="118" cy="165" rx="13" ry="8" />
          <ellipse cx="182" cy="165" rx="13" ry="8" />
          {/* Nose — shorter, more foreshortened from below */}
          <ellipse cx="150" cy="195" rx="10" ry="7" />
          {/* Mouth — visible from below */}
          <path d="M 128 220 Q 150 230 172 220" />
          {/* Chin line */}
          <path d="M 115 250 Q 150 270 185 250" strokeWidth="1.5" opacity="0.4" />
          {/* Arrow hint — tilt up */}
          <path d="M 150 70 L 150 50" strokeDasharray="4 3" strokeWidth="1.5" opacity="0.5" />
          <path d="M 144 56 L 150 50 L 156 56" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );

    case "face_down":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {/* Head tilted down — oval shifted up */}
          <ellipse cx="150" cy="160" rx="75" ry="88" />
          {/* Eyes — partially hooded, looking down */}
          <path d="M 108 145 Q 120 140 132 145" />
          <path d="M 168 145 Q 180 140 192 145" />
          {/* Nose */}
          <path d="M 150 155 L 143 175 Q 150 180 157 175 Z" />
          {/* Mouth — less visible */}
          <path d="M 135 198 Q 150 203 165 198" />
          {/* Top of head more prominent */}
          <path d="M 100 105 Q 150 60 200 105" strokeWidth="1.5" opacity="0.4" />
          {/* Arrow hint — tilt down */}
          <path d="M 150 270 L 150 290" strokeDasharray="4 3" strokeWidth="1.5" opacity="0.5" />
          <path d="M 144 284 L 150 290 L 156 284" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );

    case "expression_smile":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {headOval}
          {/* Happy eyes — slightly squinted */}
          <path d="M 108 140 Q 120 133 132 140" />
          <path d="M 168 140 Q 180 133 192 140" />
          {/* Nose */}
          <path d="M 150 155 L 143 180 Q 150 185 157 180 Z" />
          {/* Big smile */}
          <path d="M 115 200 Q 150 235 185 200" />
          {/* Smile cheek lines */}
          <path d="M 112 195 Q 108 205 115 210" strokeWidth="1.5" opacity="0.5" />
          <path d="M 188 195 Q 192 205 185 210" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );

    case "expression_neutral":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {headOval}
          {/* Neutral eyes */}
          <ellipse cx="120" cy="145" rx="12" ry="7" />
          <ellipse cx="180" cy="145" rx="12" ry="7" />
          {/* Nose */}
          <path d="M 150 155 L 143 180 Q 150 185 157 180 Z" />
          {/* Straight neutral mouth */}
          <line x1="130" y1="210" x2="170" y2="210" />
        </svg>
      );

    case "expression_serious":
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {headOval}
          {/* Serious eyes — slight brow furrow */}
          <ellipse cx="120" cy="148" rx="12" ry="6" />
          <ellipse cx="180" cy="148" rx="12" ry="6" />
          {/* Furrowed brows */}
          <path d="M 102 130 Q 120 125 138 132" strokeWidth="2" />
          <path d="M 198 130 Q 180 125 162 132" strokeWidth="2" />
          {/* Nose */}
          <path d="M 150 155 L 143 180 Q 150 185 157 180 Z" />
          {/* Firm mouth — slight downturn */}
          <path d="M 128 210 Q 150 205 172 210" />
        </svg>
      );

    case "upper_body":
      return (
        <svg viewBox="0 0 300 400" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {/* Head */}
          <ellipse cx="150" cy="80" rx="42" ry="52" />
          {/* Simple face */}
          <ellipse cx="135" cy="72" rx="6" ry="4" />
          <ellipse cx="165" cy="72" rx="6" ry="4" />
          <path d="M 150 78 L 147 90 Q 150 92 153 90 Z" strokeWidth="1.5" />
          <path d="M 140 102 Q 150 108 160 102" strokeWidth="1.5" />
          {/* Neck */}
          <path d="M 135 132 L 135 150" />
          <path d="M 165 132 L 165 150" />
          {/* Shoulders */}
          <path d="M 60 175 Q 90 150 150 148 Q 210 150 240 175" />
          {/* Torso */}
          <path d="M 60 175 L 70 350" />
          <path d="M 240 175 L 230 350" />
          {/* Arms */}
          <path d="M 60 175 L 40 290" />
          <path d="M 240 175 L 260 290" />
          {/* Waist line */}
          <path d="M 70 350 L 230 350" strokeDasharray="6 4" strokeWidth="1" opacity="0.4" />
        </svg>
      );

    case "full_body":
      return (
        <svg viewBox="0 0 300 400" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {/* Head */}
          <ellipse cx="150" cy="42" rx="28" ry="35" />
          {/* Simple face */}
          <ellipse cx="140" cy="37" rx="5" ry="3" />
          <ellipse cx="160" cy="37" rx="5" ry="3" />
          <path d="M 150 43 L 148 50 Q 150 52 152 50 Z" strokeWidth="1.5" />
          <path d="M 143 58 Q 150 62 157 58" strokeWidth="1.5" />
          {/* Neck */}
          <path d="M 140 77 L 140 88" />
          <path d="M 160 77 L 160 88" />
          {/* Shoulders + torso */}
          <path d="M 85 105 Q 110 90 150 88 Q 190 90 215 105" />
          <path d="M 85 105 L 95 230" />
          <path d="M 215 105 L 205 230" />
          {/* Arms */}
          <path d="M 85 105 L 65 200" />
          <path d="M 215 105 L 235 200" />
          {/* Hips */}
          <path d="M 95 230 Q 150 240 205 230" />
          {/* Legs */}
          <path d="M 115 235 L 110 340" />
          <path d="M 185 235 L 190 340" />
          {/* Feet */}
          <path d="M 110 340 L 95 345 L 95 350 L 115 350" />
          <path d="M 190 340 L 205 345 L 205 350 L 185 350" />
          {/* Ground line */}
          <line x1="70" y1="355" x2="230" y2="355" strokeDasharray="6 4" strokeWidth="1" opacity="0.3" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 300 340" className={common} fill="none" stroke="currentColor" strokeWidth="2.5">
          {headOval}
          {faceFeatures}
        </svg>
      );
  }
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
                <SlotSilhouette step={step} />
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
