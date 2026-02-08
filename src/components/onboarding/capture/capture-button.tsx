"use client";

import { cn } from "@/lib/utils";

interface CaptureButtonProps {
  disabled: boolean;
  ready: boolean;
  onClick: () => void;
}

export function CaptureButton({ disabled, ready, onClick }: CaptureButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 transition-all flex items-center justify-center",
        ready && !disabled
          ? "border-green-500 bg-green-500/20 hover:bg-green-500/30 animate-pulse"
          : disabled
          ? "border-muted bg-muted/20 cursor-not-allowed"
          : "border-white/50 bg-white/10 hover:bg-white/20"
      )}
      aria-label="Take photo"
    >
      <div
        className={cn(
          "w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all",
          ready && !disabled ? "bg-green-500" : disabled ? "bg-muted" : "bg-white/80"
        )}
      />
    </button>
  );
}
