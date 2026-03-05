"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { InvestigationDetail } from "@/types/investigations";
import { VERDICT_LABELS, VERDICT_COLORS } from "@/types/investigations";
import { formatDuration } from "@/lib/investigation-utils";

interface PublishTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

export function PublishTab({ data, onUpdate }: PublishTabProps) {
  const [slug, setSlug] = useState(data.slug);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPublished = data.status === "published";
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/investigations/${slug}`;

  const canPublish = data.verdict && data.summary;
  const missingFields: string[] = [];
  if (!data.verdict) missingFields.push("Verdict");
  if (!data.summary) missingFields.push("Summary");

  async function handleSlugSave() {
    setSaving(true);
    await fetch(`/api/admin/investigations/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setSaving(false);
    onUpdate();
  }

  async function handlePublish() {
    setPublishing(true);
    await fetch(`/api/admin/investigations/${data.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isPublished ? "unpublish" : "publish" }),
    });
    setPublishing(false);
    onUpdate();
  }

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Publish status */}
      <div className="bg-card rounded-xl border border-border/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          {isPublished ? (
            <Globe className="h-5 w-5 text-green-500" />
          ) : (
            <EyeOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <h3 className="font-medium">
              {isPublished ? "Published" : "Not Published"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isPublished
                ? `Published on ${new Date(data.published_at!).toLocaleDateString()}`
                : "This investigation is only visible to admins"}
            </p>
          </div>
        </div>

        {!canPublish && !isPublished && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-600">
                Missing required fields
              </span>
            </div>
            <ul className="text-xs text-yellow-700 ml-6 list-disc">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={handlePublish}
          disabled={publishing || (!canPublish && !isPublished)}
          variant={isPublished ? "outline" : "default"}
          className="gap-2"
        >
          {publishing ? (
            "Processing..."
          ) : isPublished ? (
            <>
              <EyeOff className="h-4 w-4" />
              Unpublish
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Publish Investigation
            </>
          )}
        </Button>
      </div>

      {/* Slug editor */}
      <div className="bg-card rounded-xl border border-border/50 p-6 space-y-3">
        <h3 className="text-sm font-medium">URL Slug</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">
              /investigations/
            </div>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="investigation-slug"
            />
          </div>
          <Button
            onClick={handleSlugSave}
            disabled={saving || slug === data.slug}
            variant="outline"
            size="sm"
            className="self-end"
          >
            {saving ? "Saving..." : "Update"}
          </Button>
        </div>
      </div>

      {/* Shareable URL */}
      {isPublished && (
        <div className="bg-card rounded-xl border border-border/50 p-6 space-y-3">
          <h3 className="text-sm font-medium">Shareable URL</h3>
          <div className="flex gap-2">
            <Input value={publicUrl} readOnly className="font-mono text-xs" />
            <Button
              onClick={handleCopy}
              variant="outline"
              size="icon"
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="icon" className="shrink-0">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>

          {/* Share for social */}
          <div className="pt-3 border-t border-border/30">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              Share on Social
            </h4>
            <div className="flex gap-2">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(`Investigation: ${data.title}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
              >
                Share on X
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="bg-card rounded-xl border border-border/50 p-6 space-y-4">
        <h3 className="text-sm font-medium">Preview</h3>
        <div className="border border-border/50 rounded-lg p-4 space-y-3">
          <h4 className="text-lg font-semibold">{data.title}</h4>
          {data.verdict && (
            <Badge className={VERDICT_COLORS[data.verdict]}>
              {VERDICT_LABELS[data.verdict]}
            </Badge>
          )}
          {data.confidence_score !== null && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${data.confidence_score}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {data.confidence_score}% confidence
              </span>
            </div>
          )}
          {data.summary && (
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          )}
          {(() => {
            const videos = data.media.filter((m) => m.media_type === "video");
            if (videos.length === 0) return null;
            const totalDuration = videos.reduce((sum, m) => sum + (m.duration_seconds || 0), 0);
            return (
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30">
                <span>{videos.length} video{videos.length !== 1 ? "s" : ""}</span>
                {totalDuration > 0 && <span>{formatDuration(totalDuration)} total</span>}
                <span>{data.frames.length} frames analyzed</span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
