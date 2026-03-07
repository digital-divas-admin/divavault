import { Frame, AlertCircle } from "lucide-react";
import type { InvestigationFrame } from "@/types/investigations";
import { FrameComparisonSlider } from "./frame-comparison-slider";

export function FrameGallery({
  frames,
}: {
  frames: InvestigationFrame[];
}) {
  if (frames.length === 0) return null;

  const annotatedFrames = frames.filter((f) => f.annotation_image_url);
  const otherFrames = frames.filter((f) => !f.annotation_image_url);

  return (
    <div className="space-y-6">
      {/* Annotated frames — shown large so annotations are visible */}
      {annotatedFrames.map((frame, index) => (
        <div
          key={frame.id}
          id={`frame-${frame.frame_number}`}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="relative flex justify-center">
            {frame.storage_url ? (
              <FrameComparisonSlider
                originalUrl={frame.storage_url}
                annotatedUrl={frame.annotation_image_url!}
                frameNumber={frame.frame_number}
                alt={`Frame #${frame.frame_number}`}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={frame.annotation_image_url}
                alt={`Annotated Frame #${frame.frame_number}`}
                loading="lazy"
                className="w-full"
              />
            )}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="bg-primary/90 text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
                Exhibit F{index + 1}
              </span>
              <span className="bg-primary/90 text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
                Annotated
              </span>
              {frame.is_key_evidence && (
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
                  Key Evidence
                </span>
              )}
            </div>
            {frame.has_artifacts && (
              <div className="absolute top-3 right-3" title="Artifacts detected">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            )}
          </div>
          <div className="px-5 py-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Frame #{frame.frame_number}
              </span>
              {frame.timestamp_seconds !== null && (
                <span>{frame.timestamp_seconds.toFixed(1)}s</span>
              )}
            </div>
            {frame.admin_notes && (
              <p className="text-sm text-muted-foreground mt-1">
                {frame.admin_notes}
              </p>
            )}
          </div>
        </div>
      ))}

      {/* Other key frames — smaller grid */}
      {otherFrames.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {otherFrames.map((frame) => (
            <div
              key={frame.id}
              id={`frame-${frame.frame_number}`}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                {frame.storage_url || frame.thumbnail_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={frame.thumbnail_url || frame.storage_url}
                    alt={`Frame #${frame.frame_number}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Frame className="w-8 h-8 text-muted-foreground/30" />
                )}
                {frame.has_artifacts && (
                  <div className="absolute top-2 right-2" title="Artifacts detected">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                )}
                {frame.is_key_evidence && (
                  <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    Key Evidence
                  </span>
                )}
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Frame #{frame.frame_number}</span>
                  {frame.timestamp_seconds !== null && (
                    <span>{frame.timestamp_seconds.toFixed(1)}s</span>
                  )}
                </div>
                {frame.admin_notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {frame.admin_notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
