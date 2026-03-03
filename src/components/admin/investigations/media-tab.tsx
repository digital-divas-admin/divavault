"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Film,
  ImageIcon,
  ExternalLink,
} from "lucide-react";
import type { InvestigationDetail, InvestigationMedia } from "@/types/investigations";

interface MediaTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

export function MediaTab({ data, onUpdate }: MediaTabProps) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAddMedia(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);

    await fetch(`/api/admin/investigations/${data.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_url: url }),
    });

    setUrl("");
    setAdding(false);
    onUpdate();
  }

  return (
    <div className="space-y-6">
      {/* Add media form */}
      <div className="bg-card rounded-xl border border-border/50 p-6">
        <h3 className="text-sm font-medium mb-3">Add Media URL</h3>
        <form onSubmit={handleAddMedia} className="flex gap-3">
          <Input
            placeholder="Paste video or image URL (YouTube, TikTok, X, direct link...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !url.trim()} size="sm" className="gap-2">
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Supports YouTube, TikTok, X/Twitter, Facebook, Instagram, Rumble, and direct media URLs.
          Media will be downloaded and processed by the scanner backend.
        </p>
      </div>

      {/* Media list */}
      {data.media.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
          <Download className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No media added yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a URL above to start acquiring media
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.media.map((media) => (
            <MediaCard key={media.id} media={media} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({ media }: { media: InvestigationMedia }) {
  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    downloading: <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <AlertCircle className="h-4 w-4 text-red-500" />,
  }[media.download_status];

  const statusLabel = {
    pending: "Queued",
    downloading: "Downloading...",
    completed: "Downloaded",
    failed: "Failed",
  }[media.download_status];

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {media.media_type === "video" ? (
            <Film className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {statusIcon}
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
            {media.platform && (
              <Badge variant="outline" className="text-[10px]">
                {media.platform}
              </Badge>
            )}
          </div>
          <a
            href={media.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate block"
          >
            {media.source_url}
            <ExternalLink className="h-3 w-3 inline ml-1" />
          </a>
          {media.download_error && (
            <p className="text-xs text-destructive mt-1">{media.download_error}</p>
          )}
          {media.download_status === "completed" && (
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              {media.duration_seconds && (
                <span>{Math.round(media.duration_seconds)}s</span>
              )}
              {media.resolution_width && media.resolution_height && (
                <span>
                  {media.resolution_width}x{media.resolution_height}
                </span>
              )}
              {media.codec && <span>{media.codec}</span>}
              {media.file_size_bytes && (
                <span>{(media.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
