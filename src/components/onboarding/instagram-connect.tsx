"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export function InstagramConnect() {
  const searchParams = useSearchParams();
  const {
    instagramConnected,
    instagramMedia,
    setInstagramConnected,
    setInstagramMedia,
  } = useOnboardingStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After OAuth redirect, detect ig_connected param and fetch media
  useEffect(() => {
    const igConnected = searchParams.get("ig_connected");
    const igError = searchParams.get("ig_error");

    if (igError) {
      const messages: Record<string, string> = {
        denied: "Instagram access wasn't granted — no worries, you can upload photos manually instead.",
        missing_params: "Missing parameters from Instagram.",
        invalid_state: "Invalid security token. Please try again.",
        exchange_failed: "We couldn't connect to Instagram this time. You can try again, or just upload photos directly.",
        no_media: "No photos found on your Instagram account.",
      };
      setError(messages[igError] || "An error occurred. Please try again.");
      return;
    }

    if (igConnected === "true" && !instagramConnected) {
      fetchMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function fetchMedia() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/instagram/media");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch media");
      }

      const { media } = await res.json();
      setInstagramMedia(media);
      setInstagramConnected(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load Instagram photos"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    window.location.href = "/api/instagram/auth";
  }

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/50 rounded-xl">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 text-neon mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium mb-1">Loading Instagram photos...</p>
          <p className="text-xs text-muted-foreground">
            This may take a moment if you have many photos
          </p>
        </CardContent>
      </Card>
    );
  }

  if (instagramConnected && instagramMedia.length > 0) {
    return (
      <Card className="border-green-500/20 bg-green-500/5 rounded-xl">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Instagram Connected</p>
            <p className="text-xs text-muted-foreground">
              {instagramMedia.length} photos loaded. Tap the ones you&apos;d like to contribute — only the ones you select will be used.
            </p>
          </div>
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            Connected
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
      <CardContent className="p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
          <Instagram className="w-6 h-6 text-white" />
        </div>
        <h3 className="font-semibold mb-1">Import from Instagram</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We&apos;ll pull your public photos so you can choose which ones to share. We only read your media — we never post, follow, or modify anything.
        </p>

        {error && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          onClick={handleConnect}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
        >
          <Instagram className="mr-2 w-4 h-4" />
          Connect Instagram
        </Button>
      </CardContent>
    </Card>
  );
}
