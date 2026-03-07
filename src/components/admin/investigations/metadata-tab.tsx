"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileCode, Info } from "lucide-react";
import type { InvestigationDetail } from "@/types/investigations";

interface MetadataTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

export function MetadataTab({ data, onUpdate: _onUpdate }: MetadataTabProps) {
  const mediaWithMetadata = data.media.filter(
    (m) => m.ffprobe_data || m.exif_data
  );

  if (mediaWithMetadata.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
        <FileCode className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">No metadata available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Metadata is extracted after media download completes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mediaWithMetadata.map((media) => {
        const anomalies = detectAnomalies(media);
        return (
          <div key={media.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-border/30">
              <h3 className="text-sm font-medium truncate">{media.source_url}</h3>
              <div className="flex gap-2 mt-1">
                {media.platform && (
                  <Badge variant="outline" className="text-[10px]">
                    {media.platform}
                  </Badge>
                )}
                {media.codec && (
                  <Badge variant="outline" className="text-[10px]">
                    {media.codec}
                  </Badge>
                )}
                {media.resolution_width && media.resolution_height && (
                  <Badge variant="outline" className="text-[10px]">
                    {media.resolution_width}x{media.resolution_height}
                  </Badge>
                )}
              </div>
            </div>

            {/* Anomaly detection */}
            {anomalies.length > 0 && (
              <div className="px-6 py-3 bg-yellow-500/5 border-b border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-600">
                    Metadata Anomalies
                  </span>
                </div>
                <ul className="space-y-1">
                  {anomalies.map((anomaly, i) => (
                    <li key={i} className="text-xs text-yellow-700 flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      {anomaly}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ffprobe data */}
            {media.ffprobe_data && (
              <div className="px-6 py-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  FFprobe Data
                </h4>
                <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-[400px] overflow-y-auto">
                  {JSON.stringify(media.ffprobe_data, null, 2)}
                </pre>
              </div>
            )}

            {/* EXIF data */}
            {media.exif_data && (
              <div className="px-6 py-4 border-t border-border/30">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  EXIF Data
                </h4>
                <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-[400px] overflow-y-auto">
                  {JSON.stringify(media.exif_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function detectAnomalies(media: { ffprobe_data: Record<string, unknown> | null; exif_data: Record<string, unknown> | null; codec: string | null }): string[] {
  const anomalies: string[] = [];

  if (!media.ffprobe_data && !media.exif_data) {
    anomalies.push("No metadata found — file may have been stripped or re-encoded");
  }

  if (media.exif_data) {
    const exif = media.exif_data as Record<string, string>;
    if (!exif.Make && !exif.Model && !exif.Software) {
      anomalies.push("EXIF data present but no camera/software info — possible synthetic origin");
    }
  }

  if (media.codec) {
    const unusual = ["h265", "hevc", "av1", "vp9"];
    if (unusual.some((c) => media.codec?.toLowerCase().includes(c))) {
      anomalies.push(`Unusual codec: ${media.codec} — may indicate re-encoding`);
    }
  }

  if (media.ffprobe_data) {
    const probe = media.ffprobe_data as Record<string, unknown>;
    const format = probe.format as Record<string, unknown> | undefined;
    if (format?.tags) {
      const tags = format.tags as Record<string, string>;
      if (tags.encoder?.toLowerCase().includes("lavf") || tags.encoder?.toLowerCase().includes("ffmpeg")) {
        anomalies.push(`Encoded with FFmpeg/libav — may indicate post-processing`);
      }
    }
  }

  return anomalies;
}
