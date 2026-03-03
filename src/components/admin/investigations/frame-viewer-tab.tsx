"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Star,
  AlertTriangle,
  Save,
  ExternalLink,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Bot,
  SearchCheck,
  Newspaper,
  Globe,
  Pen,
} from "lucide-react";
import { FrameAnnotationCanvas } from "./frame-annotation-canvas";
import { buildReverseSearchUrl } from "@/lib/investigation-utils";
import type { InvestigationDetail, InvestigationFrame, TaskType } from "@/types/investigations";

interface FrameViewerTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

export function FrameViewerTab({ data, onUpdate }: FrameViewerTabProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const frames = data.frames;

  if (frames.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
        <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">No frames extracted yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add media and wait for frame extraction to complete
        </p>
      </div>
    );
  }

  const selected = frames[selectedIdx];

  return (
    <div className="space-y-4">
      {/* Filmstrip */}
      <div className="bg-card rounded-xl border border-border/50 p-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {frames.map((frame, i) => (
            <button
              key={frame.id}
              onClick={() => setSelectedIdx(i)}
              className={`relative shrink-0 w-20 h-14 rounded-lg border-2 transition-all overflow-hidden ${
                i === selectedIdx
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border/50 hover:border-border"
              }`}
            >
              {frame.thumbnail_url ? (
                <img
                  src={frame.thumbnail_url}
                  alt={`Frame #${frame.frame_number}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">#{frame.frame_number}</span>
                </div>
              )}
              {frame.is_key_evidence && (
                <div className="absolute top-0.5 right-0.5">
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                </div>
              )}
              {frame.has_artifacts && (
                <div className="absolute bottom-0.5 right-0.5">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                </div>
              )}
              {frame.drawing_data && (
                <div className="absolute bottom-0.5 left-0.5">
                  <Pen className="h-3 w-3 text-purple-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Frame detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Frame viewer */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            {/* Frame image area */}
            <div className="aspect-video bg-muted flex items-center justify-center relative">
              {selected.storage_url ? (
                <img
                  src={selected.storage_url}
                  alt={`Frame #${selected.frame_number}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Frame #{selected.frame_number}</p>
                  {selected.timestamp_seconds !== null && (
                    <p className="text-xs text-muted-foreground">
                      {selected.timestamp_seconds.toFixed(2)}s
                    </p>
                  )}
                </div>
              )}
              {/* Nav arrows */}
              {selectedIdx > 0 && (
                <button
                  onClick={() => setSelectedIdx(selectedIdx - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {selectedIdx < frames.length - 1 && (
                <button
                  onClick={() => setSelectedIdx(selectedIdx + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Frame info bar */}
            <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Frame {selectedIdx + 1} of {frames.length}</span>
                {selected.has_artifacts && (
                  <Badge className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                    Artifacts Detected
                  </Badge>
                )}
                {selected.is_key_evidence && (
                  <Badge className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Key Evidence
                  </Badge>
                )}
                {selected.annotation_image_url && (
                  <Badge className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                    Has Annotations
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => setAnnotateOpen(true)}
              >
                <Pen className="h-3.5 w-3.5" />
                Annotate
              </Button>
            </div>
          </div>
        </div>

        {/* Annotation panel */}
        <div className="space-y-4">
          <FrameAnnotationPanel key={selected.id} frame={selected} onUpdate={onUpdate} investigationId={data.id} />

          {/* Reverse search buttons */}
          <div className="bg-card rounded-xl border border-border/50 p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Reverse Image Search
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Open search engines in a new tab to find this frame across the web.
            </p>
            <div className="space-y-2">
              {(["tineye", "google_lens", "yandex"] as const).map((engine) => {
                const searchUrl = buildReverseSearchUrl(
                  engine,
                  selected.storage_url || ""
                );
                return (
                  <a
                    key={engine}
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 text-sm hover:bg-accent/50 transition-colors"
                  >
                    <span className="capitalize">
                      {engine === "google_lens" ? "Google Lens" : engine === "tineye" ? "TinEye" : "Yandex"}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Automated Analysis */}
          <AutomatedAnalysisPanel
            investigationId={data.id}
            frameId={selected.id}
            frames={frames}
            onUpdate={onUpdate}
          />
        </div>
      </div>

      {/* Annotation Canvas Dialog */}
      <FrameAnnotationCanvas
        frame={selected}
        investigationId={data.id}
        open={annotateOpen}
        onOpenChange={setAnnotateOpen}
        onSaved={() => {
          setAnnotateOpen(false);
          onUpdate();
        }}
      />
    </div>
  );
}

function FrameAnnotationPanel({
  frame,
  onUpdate,
  investigationId,
}: {
  frame: InvestigationFrame;
  onUpdate: () => void;
  investigationId: string;
}) {
  const [notes, setNotes] = useState(frame.admin_notes || "");
  const [hasArtifacts, setHasArtifacts] = useState(frame.has_artifacts);
  const [isKeyEvidence, setIsKeyEvidence] = useState(frame.is_key_evidence);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/investigations/${investigationId}/frames/${frame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_notes: notes || null,
        has_artifacts: hasArtifacts,
        is_key_evidence: isKeyEvidence,
      }),
    });
    setSaving(false);
    onUpdate();
  }

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
      <h3 className="text-sm font-medium">Annotations</h3>

      <Textarea
        placeholder="Notes about this frame..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasArtifacts}
            onChange={(e) => setHasArtifacts(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          <span className="text-sm">Has artifacts</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isKeyEvidence}
            onChange={(e) => setIsKeyEvidence(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          <span className="text-sm">Key evidence</span>
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save Annotations"}
      </Button>
    </div>
  );
}

function AutomatedAnalysisPanel({
  investigationId,
  frameId,
  frames,
  onUpdate,
}: {
  investigationId: string;
  frameId: string;
  frames: InvestigationFrame[];
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState<TaskType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  async function triggerTask(taskTypes: TaskType[], frameIds?: string[]) {
    setLoading(taskTypes[0]);
    setError(null);
    setSuccessCount(null);
    try {
      const res = await fetch(`/api/admin/investigations/${investigationId}/automated-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_types: taskTypes, frame_ids: frameIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
        setError(msg);
        return;
      }
      const data = await res.json();
      const count = data.tasks?.length ?? 0;
      setSuccessCount(count);
      if (count === 0) {
        setError("No tasks created — are there frames to analyze?");
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach server");
    } finally {
      setLoading(null);
      setTimeout(() => { setSuccessCount(null); setError(null); }, 8000);
    }
  }

  const keyFrameIds = frames.filter((f) => f.is_key_evidence).map((f) => f.id);

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <SearchCheck className="h-4 w-4" />
        Automated Analysis
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Run automated searches and AI analysis on frames.
      </p>
      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={loading !== null}
          onClick={() => triggerTask(["reverse_search"], [frameId])}
        >
          <Search className="h-3.5 w-3.5" />
          {loading === "reverse_search" ? "Searching..." : "Search This Frame"}
        </Button>
        {keyFrameIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={loading !== null}
            onClick={() => triggerTask(["reverse_search"], keyFrameIds)}
          >
            <Star className="h-3.5 w-3.5" />
            {loading === "reverse_search" ? "Searching..." : `Search All Key Frames (${keyFrameIds.length})`}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={loading !== null}
          onClick={() => triggerTask(["ai_detection"], [frameId])}
        >
          <Bot className="h-3.5 w-3.5" />
          {loading === "ai_detection" ? "Analyzing..." : "AI Detection"}
        </Button>

        <div className="border-t border-border/30 my-2" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Investigation-level</p>

        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={loading !== null}
          onClick={() => triggerTask(["news_search"])}
        >
          <Newspaper className="h-3.5 w-3.5" />
          {loading === "news_search" ? "Searching..." : "News Search"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={loading !== null}
          onClick={() => triggerTask(["wire_search"])}
        >
          <Globe className="h-3.5 w-3.5" />
          {loading === "wire_search" ? "Searching..." : "AP / Getty Check"}
        </Button>

        {/* Feedback messages */}
        {error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
        {successCount !== null && successCount > 0 && !error && (
          <p className="text-xs text-green-400 mt-1">
            Created {successCount} task{successCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
