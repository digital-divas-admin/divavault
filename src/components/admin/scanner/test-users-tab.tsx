"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import type { HoneypotItem } from "@/lib/scanner-command-queries";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HoneypotTable } from "./honeypot-table";
import {
  Users,
  FlaskConical,
  Sparkles,
  Target,
  ArrowRight,
  Zap,
  RefreshCw,
  Loader2,
  UserPlus,
  X,
  ImageIcon,
} from "lucide-react";

interface TestUsersTabProps {
  testUserSummary: { seeded: number; honeypot: number; synthetic: number };
  honeypotItems: HoneypotItem[];
}

const SCALE_PHASES = [
  {
    phase: 1,
    label: "Seed",
    description: "Manual test contributors with known embeddings",
    color: "bg-blue-500",
  },
  {
    phase: 2,
    label: "Honeypot",
    description: "Planted content across platforms for detection validation",
    color: "bg-purple-500",
  },
  {
    phase: 3,
    label: "Synthetic",
    description: "AI-generated test faces to scale coverage testing",
    color: "bg-indigo-500",
  },
  {
    phase: 4,
    label: "Production",
    description: "Full-scale monitoring with real contributor base",
    color: "bg-green-500",
  },
];

const PLATFORM_OPTIONS = [
  { value: "all", label: "All Platforms" },
  { value: "civitai", label: "CivitAI" },
  { value: "deviantart", label: "DeviantArt" },
  { value: "fourchan", label: "4chan" },
  { value: "reddit", label: "Reddit" },
];

export function TestUsersTab({
  testUserSummary,
  honeypotItems,
}: TestUsersTabProps) {
  const detectedCount = honeypotItems.filter((h) => h.detected === true).length;
  const totalPlanted = honeypotItems.filter((h) => h.detected !== null).length;
  const detectionRate =
    totalPlanted > 0 ? ((detectedCount / totalPlanted) * 100).toFixed(1) : "0";

  // Create test user state
  const [seedName, setSeedName] = useState("");
  const [seedEmail, setSeedEmail] = useState("");
  const [seedTier, setSeedTier] = useState("premium");
  const [seedFiles, setSeedFiles] = useState<File[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoize blob URLs and revoke on cleanup
  const previewUrls = useMemo(
    () => seedFiles.map((f) => URL.createObjectURL(f)),
    [seedFiles]
  );
  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setSeedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function removeFile(index: number) {
    setSeedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateTestUser() {
    if (!seedName.trim()) {
      setSeedError("Name is required");
      return;
    }
    if (seedFiles.length === 0) {
      setSeedError("At least one photo is required");
      return;
    }

    setSeeding(true);
    setSeedResult(null);
    setSeedError(null);

    try {
      const supabase = createBrowserClient();
      const folderId = crypto.randomUUID();

      // Upload all photos in parallel
      const uploadResults = await Promise.all(
        seedFiles.map(async (file) => {
          const filePath = `test-${folderId}/${file.name}`;
          const { error } = await supabase.storage
            .from("capture-uploads")
            .upload(filePath, file);
          return { file, filePath, error };
        })
      );
      const failed = uploadResults.find((r) => r.error);
      if (failed) {
        setSeedError(
          `Upload failed for ${failed.file.name}: ${failed.error!.message}`
        );
        setSeeding(false);
        return;
      }
      const photoPaths = uploadResults.map((r) => ({
        bucket: "capture-uploads",
        file_path: r.filePath,
      }));

      // Call the seed-contributor API
      const email =
        seedEmail.trim() ||
        `test-${Date.now()}@test.consentedai.com`;
      const res = await fetch("/api/admin/scanner/seed-contributor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: seedName.trim(),
          email,
          photo_paths: photoPaths,
          subscription_tier: seedTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSeedError(data.error || "Failed to create test user");
      } else {
        setSeedResult(
          `Created test user "${seedName.trim()}" (${data.contributor_id}). ${data.images_queued} photo(s) queued for embedding.`
        );
        // Reset form
        setSeedName("");
        setSeedEmail("");
        setSeedTier("premium");
        setSeedFiles([]);
      }
    } catch {
      setSeedError("Failed to reach server");
    } finally {
      setSeeding(false);
    }
  }

  // Auto-generate honeypot state
  const [count, setCount] = useState(20);
  const [platform, setPlatform] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateResult(null);
    setGenerateError(null);
    try {
      const res = await fetch("/api/admin/scanner/auto-honeypot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          ...(platform !== "all" ? { platform } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || "Generation failed");
      } else {
        setGenerateResult(
          `Successfully generated ${data.generated} honeypot test contributor${data.generated !== 1 ? "s" : ""}.`
        );
      }
    } catch {
      setGenerateError("Failed to reach server");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDetectionCheck() {
    setChecking(true);
    setCheckResult(null);
    setCheckError(null);
    try {
      const res = await fetch("/api/admin/scanner/honeypot-report");
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || "Detection check failed");
      } else {
        const rate = data.detection_rate != null
          ? `${(data.detection_rate * 100).toFixed(1)}%`
          : "N/A";
        setCheckResult(
          `Detection: ${data.total_detected}/${data.total_planted} (${rate}). ${data.newly_detected} newly detected.`
        );
      }
    } catch {
      setCheckError("Failed to reach server");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium">Seeded Contributors</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {testUserSummary.seeded}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Test accounts with known face embeddings
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-purple-500/10">
                <FlaskConical className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-sm font-medium">Honeypot Contributors</span>
            </div>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
                {testUserSummary.honeypot}
              </p>
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-green-400" />
                <span className="text-sm font-[family-name:var(--font-mono)] text-green-400">
                  {detectionRate}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  detection rate
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {detectedCount} detected / {totalPlanted} planted
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-indigo-500/10">
                <Sparkles className="h-4 w-4 text-indigo-400" />
              </div>
              <span className="text-sm font-medium">Synthetic</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {testUserSummary.synthetic}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              AI-generated test faces for scale testing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create Test User */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Create Test User
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Create a seeded test contributor with real photos. Photos are
              uploaded to storage and processed through the full face detection
              &rarr; embedding &rarr; matching pipeline.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="seed-name" className="text-xs">
                  Full Name *
                </Label>
                <Input
                  id="seed-name"
                  placeholder="Jane Test"
                  value={seedName}
                  onChange={(e) => setSeedName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seed-email" className="text-xs">
                  Email{" "}
                  <span className="text-muted-foreground">(auto-generated if blank)</span>
                </Label>
                <Input
                  id="seed-email"
                  type="email"
                  placeholder="test-xxx@test.consentedai.com"
                  value={seedEmail}
                  onChange={(e) => setSeedEmail(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seed-tier" className="text-xs">
                  Subscription Tier
                </Label>
                <Select value={seedTier} onValueChange={setSeedTier}>
                  <SelectTrigger id="seed-tier" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="protected">Protected</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Photos *</Label>
              <div className="flex flex-wrap gap-2">
                {seedFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="relative group w-16 h-16 rounded-md overflow-hidden border border-border/30 bg-background"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrls[i]}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-md border border-dashed border-border/50 flex items-center justify-center hover:border-purple-500/50 transition-colors"
                >
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <p className="text-[10px] text-muted-foreground">
                {seedFiles.length} photo{seedFiles.length !== 1 ? "s" : ""}{" "}
                selected
              </p>
            </div>

            <Button
              size="sm"
              onClick={handleCreateTestUser}
              disabled={seeding || !seedName.trim() || seedFiles.length === 0}
              className="h-9"
            >
              {seeding ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Create Test User
            </Button>

            {seedResult && (
              <p className="text-xs text-green-400">{seedResult}</p>
            )}
            {seedError && (
              <p className="text-xs text-red-400">{seedError}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auto-Generate Honeypots */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Auto-Generate Honeypots
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Pick random face embeddings from already-crawled images, create
              test contributor profiles, and verify detection.
            </p>

            <div className="flex items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="honeypot-count" className="text-xs">
                  Count
                </Label>
                <Input
                  id="honeypot-count"
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 1)}
                  className="w-24 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="honeypot-platform" className="text-xs">
                  Platform
                </Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="honeypot-platform" className="w-44 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generating || checking}
                className="h-9"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                )}
                Generate Honeypots
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDetectionCheck}
                disabled={generating || checking}
                className="h-9"
              >
                {checking ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Run Detection Check
              </Button>
            </div>

            {generateResult && (
              <p className="text-xs text-green-400">{generateResult}</p>
            )}
            {generateError && (
              <p className="text-xs text-red-400">{generateError}</p>
            )}
            {checkResult && (
              <p className="text-xs text-green-400">{checkResult}</p>
            )}
            {checkError && (
              <p className="text-xs text-red-400">{checkError}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Honeypot detection table */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Honeypot Detection Results
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <HoneypotTable items={honeypotItems} />
          </CardContent>
        </Card>
      </div>

      {/* Scale transition plan */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Scale Transition Plan
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {SCALE_PHASES.map((phase, i) => (
                <div key={phase.phase} className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className={`w-6 h-6 rounded-full ${phase.color} flex items-center justify-center text-[10px] font-bold text-white`}
                      >
                        {phase.phase}
                      </div>
                      <span className="text-sm font-medium">{phase.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {phase.description}
                    </p>
                  </div>
                  {i < SCALE_PHASES.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
