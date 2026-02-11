"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, RotateCcw, Fingerprint } from "lucide-react";
import type { SelectedContributor } from "./contributor-picker";

interface EmbeddingStats {
  images: { pending: number; completed: number; failed: number };
  uploads: { pending: number; completed: number; failed: number };
  embeddingsCount: number;
}

interface EmbeddingPanelProps {
  contributor: SelectedContributor;
}

export function EmbeddingPanel({ contributor }: EmbeddingPanelProps) {
  const router = useRouter();
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/scanner/embedding-status?contributorId=${encodeURIComponent(contributor.id)}`
        );
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [contributor.id]);

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scanner/reset-embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributorId: contributor.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reset failed");
      }

      setConfirmOpen(false);

      // Refetch stats
      const statsRes = await fetch(
        `/api/admin/scanner/embedding-status?contributorId=${encodeURIComponent(contributor.id)}`
      );
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-primary" />
          Embedding Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Captured Images
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  {stats.images.pending} pending
                </Badge>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  {stats.images.completed} completed
                </Badge>
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                  {stats.images.failed} failed
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Uploads
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  {stats.uploads.pending} pending
                </Badge>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  {stats.uploads.completed} completed
                </Badge>
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                  {stats.uploads.failed} failed
                </Badge>
              </div>
            </div>

            <p className="text-sm">
              <span className="text-muted-foreground">Total embeddings: </span>
              <span className="font-medium">{stats.embeddingsCount}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No embedding data available for this contributor.
          </p>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All Embeddings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset embeddings for {contributor.name}?</DialogTitle>
              <DialogDescription>
                This will set all image embedding statuses back to &ldquo;pending&rdquo;,
                clear embedding errors, and delete all computed embeddings. The
                scanner will re-process them on the next run.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReset} disabled={resetting}>
                {resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset Embeddings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
