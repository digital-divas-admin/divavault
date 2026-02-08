"use client";

import { Input } from "@/components/ui/input";

interface ImageCaptionInputProps {
  caption: string;
  onChange: (caption: string) => void;
}

export function ImageCaptionInput({ caption, onChange }: ImageCaptionInputProps) {
  return (
    <Input
      placeholder="Add a brief caption (optional)"
      value={caption}
      onChange={(e) => onChange(e.target.value)}
      maxLength={500}
      className="text-xs bg-card border-border/30 h-8"
    />
  );
}
