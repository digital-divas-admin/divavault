import { Frame, AlertCircle } from "lucide-react";
import type { InvestigationFrame } from "@/types/investigations";

export function FrameGallery({ frames }: { frames: InvestigationFrame[] }) {
  if (frames.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {frames.map((frame) => (
        <div
          key={frame.id}
          className="bg-card border border-border rounded-lg overflow-hidden"
        >
          {/* Frame placeholder */}
          <div className="aspect-video bg-muted flex items-center justify-center relative">
            <Frame className="w-8 h-8 text-muted-foreground/30" />
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
  );
}
