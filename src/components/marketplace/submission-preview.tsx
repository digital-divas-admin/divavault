"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageCaptionInput } from "./image-caption-input";

export interface PreviewImage {
  filePath: string;
  bucket: string;
  fileSize: number;
  localUrl?: string;
  signedUrl?: string;
  caption: string;
}

interface SubmissionPreviewProps {
  images: PreviewImage[];
  onRemove: (filePath: string) => void;
  onCaptionChange: (filePath: string, caption: string) => void;
}

export function SubmissionPreview({
  images,
  onRemove,
  onCaptionChange,
}: SubmissionPreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {images.length} {images.length === 1 ? "photo" : "photos"} ready
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img) => (
          <div key={img.filePath} className="space-y-1.5">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted/30 group">
              {(img.localUrl || img.signedUrl) && (
                <Image
                  src={img.localUrl || img.signedUrl || ""}
                  alt={img.caption || "Submission photo"}
                  fill
                  className="object-cover"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(img.filePath)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <ImageCaptionInput
              caption={img.caption}
              onChange={(c) => onCaptionChange(img.filePath, c)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
