"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileCode, Info, Bot, ShieldCheck, Newspaper, Globe } from "lucide-react";
import type { InvestigationDetail, TaskType } from "@/types/investigations";

interface MetadataTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

export function MetadataTab({ data, onUpdate }: MetadataTabProps) {
  const mediaWithMetadata = data.media.filter(
    (m) => m.ffprobe_data || m.exif_data
  );

  const aiEvidence = data.evidence.filter((e) => e.evidence_type === "ai_detection");
  const provEvidence = data.evidence.filter((e) => e.evidence_type === "provenance_check");

  return (
    <div className="space-y-6">
      {/* Analysis Trigger Buttons */}
      <div className="flex gap-2">
        <AnalysisTriggerButton
          investigationId={data.id}
          taskType="check_provenance"
          label="Run Provenance Check"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
        <AnalysisTriggerButton
          investigationId={data.id}
          taskType="ai_detection"
          label="Run AI Detection"
          icon={<Bot className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
        <AnalysisTriggerButton
          investigationId={data.id}
          taskType="news_search"
          label="News Search"
          icon={<Newspaper className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
        <AnalysisTriggerButton
          investigationId={data.id}
          taskType="wire_search"
          label="Wire Service Check"
          icon={<Globe className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
      </div>

      {/* AI Generation Detection */}
      {aiEvidence.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-500" />
            AI Generation Detection
          </h3>
          <div className="space-y-3">
            {aiEvidence.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="shrink-0">
                  {ev.ai_detection_score !== null && ev.ai_detection_score > 0.7 ? (
                    <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                      {(ev.ai_detection_score * 100).toFixed(0)}% AI
                    </Badge>
                  ) : ev.ai_detection_score !== null ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                      {(ev.ai_detection_score * 100).toFixed(0)}% AI
                    </Badge>
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  {ev.title && <p className="text-sm font-medium">{ev.title}</p>}
                  {ev.content && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.content}</p>}
                  {ev.ai_detection_generator && (
                    <Badge variant="outline" className="text-[10px] mt-2">
                      Generator: {ev.ai_detection_generator}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Provenance (C2PA) */}
      {provEvidence.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Content Provenance (C2PA)
          </h3>
          <div className="space-y-3">
            {provEvidence.map((ev) => (
              <div key={ev.id} className="p-3 rounded-lg bg-muted/30">
                {ev.title && <p className="text-sm font-medium">{ev.title}</p>}
                {ev.content && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.content}</p>}
                {ev.provenance_data && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Raw provenance data
                    </summary>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 mt-2 overflow-x-auto max-h-[200px] overflow-y-auto">
                      {JSON.stringify(ev.provenance_data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for metadata */}
      {mediaWithMetadata.length === 0 && aiEvidence.length === 0 && provEvidence.length === 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
          <FileCode className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No metadata available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Metadata is extracted after media download completes
          </p>
        </div>
      )}

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

function AnalysisTriggerButton({
  investigationId,
  taskType,
  label,
  icon,
  onUpdate,
}: {
  investigationId: string;
  taskType: TaskType;
  label: string;
  icon: React.ReactNode;
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/admin/investigations/${investigationId}/automated-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_types: [taskType] }),
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" className="gap-2" onClick={handleClick} disabled={loading}>
      {icon}
      {loading ? "Running..." : label}
    </Button>
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
