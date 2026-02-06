"use client";

import { useOnboardingStore } from "@/stores/onboarding-store";
import { cn } from "@/lib/utils";
import { Check, X, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MIN_PHOTOS = 25;

export function PhotoGallery() {
  const {
    instagramMedia,
    selectedPhotoIds,
    togglePhotoSelection,
    uploadedPhotos,
    removeUploadedPhoto,
    totalPhotoCount,
  } = useOnboardingStore();

  const count = totalPhotoCount();
  const hasEnough = count >= MIN_PHOTOS;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">
          Your Contribution
        </h3>
        <Badge
          variant={hasEnough ? "default" : "secondary"}
          className={cn(
            hasEnough && "bg-green-500/10 text-green-500 border-green-500/20"
          )}
        >
          {count}/{MIN_PHOTOS} minimum
        </Badge>
      </div>

      {count === 0 && (
        <div className="border border-dashed border-border/50 rounded-xl p-12 text-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No photos added yet. Import from Instagram above, or drag and drop
            files to get started.
          </p>
        </div>
      )}

      {/* Instagram photos */}
      {instagramMedia.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
            Instagram Photos
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {instagramMedia.map((media) => {
              const isSelected = selectedPhotoIds.includes(media.id);
              return (
                <button
                  key={media.id}
                  onClick={() => togglePhotoSelection(media.id)}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                    isSelected
                      ? "border-neon ring-2 ring-neon/30"
                      : "border-transparent hover:border-border"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media.thumbnail_url || media.media_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-neon/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-neon" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Manually uploaded photos */}
      {uploadedPhotos.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
            Uploaded Photos
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {uploadedPhotos.map((path) => (
              <div
                key={path}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-neon/30 bg-muted group"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <button
                  onClick={() => removeUploadedPhoto(path)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive/80 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                  <p className="text-[10px] text-white truncate">
                    {path.split("/").pop()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasEnough && count > 0 && (
        <p className="text-sm text-muted-foreground mt-4">
          {MIN_PHOTOS - count} more photo
          {MIN_PHOTOS - count !== 1 ? "s" : ""} to go. The more variety you
          include (different angles, lighting, outfits), the better the AI model
          will represent you.
        </p>
      )}
    </div>
  );
}
