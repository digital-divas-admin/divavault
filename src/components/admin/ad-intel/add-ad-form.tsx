"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";

const PLATFORMS = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
];

export function AddAdForm() {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!url.trim()) {
      setError("URL is required");
      return;
    }
    if (!platform) {
      setError("Platform is required");
      return;
    }

    try {
      new URL(url);
    } catch {
      setError("Invalid URL format");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/ad-intel/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          platform,
          advertiserName: advertiserName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add ad");
      }

      setSuccess(true);
      setUrl("");
      setPlatform("");
      setAdvertiserName("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add ad");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Add Ad Manually</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ad-url" className="text-xs">
              Ad Creative URL
            </Label>
            <Input
              id="ad-url"
              type="url"
              placeholder="https://example.com/ad-image.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ad-platform" className="text-xs">
                Platform
              </Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ad-advertiser" className="text-xs">
                Advertiser (optional)
              </Label>
              <Input
                id="ad-advertiser"
                placeholder="Brand name"
                value={advertiserName}
                onChange={(e) => setAdvertiserName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            size="sm"
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : success ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {success ? "Ad Queued" : "Add to Pipeline"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
