"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Instagram, Upload, Trash2 } from "lucide-react";
import { UploadStatusBadge } from "./upload-status-badge";
import { ConfirmationDialog } from "@/components/dashboard/confirmation-dialog";
import type { DashboardUpload } from "@/types/dashboard";

interface PhotoCardProps {
  upload: DashboardUpload;
  onRemove: (id: string) => void;
}

export function PhotoCard({ upload, onRemove }: PhotoCardProps) {
  const [showRemove, setShowRemove] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    setLoading(true);
    await onRemove(upload.id);
    setLoading(false);
    setShowRemove(false);
  };

  const formattedDate = new Date(upload.created_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  return (
    <>
      <Card className="border-border/50 bg-card rounded-lg overflow-hidden group relative">
        {/* Image */}
        <div className="aspect-square bg-muted/30 relative">
          {upload.signed_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={upload.signed_url}
              alt={upload.display_name || "Contributed photo"}
              className={`w-full h-full object-cover ${upload.status === "removed" ? "opacity-40 grayscale" : ""}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}

          {/* Status badge overlay */}
          <div className="absolute top-2 left-2">
            <UploadStatusBadge status={upload.status} />
          </div>

          {/* Source icon */}
          <div className="absolute top-2 right-2">
            {upload.source === "instagram" ? (
              <div className="rounded-full bg-background/80 p-1">
                <Instagram className="h-3 w-3 text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-full bg-background/80 p-1">
                <Upload className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Hover actions */}
          {upload.status !== "removed" && (
            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRemove(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2">
          <p className="text-[11px] text-muted-foreground">{formattedDate}</p>
        </div>
      </Card>

      <ConfirmationDialog
        open={showRemove}
        onOpenChange={setShowRemove}
        title="Remove from Training"
        description="We'll remove this photo from future AI training. Note: existing models that have already been trained cannot be un-trained — this only affects future training batches."
        confirmLabel="Remove Photo"
        variant="destructive"
        onConfirm={handleRemove}
        loading={loading}
      />
    </>
  );
}
