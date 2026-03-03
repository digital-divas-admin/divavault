"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import type { InvestigationCategory } from "@/types/investigations";
import { CATEGORY_LABELS } from "@/types/investigations";

const categories: InvestigationCategory[] = [
  "war_misinfo",
  "political",
  "celebrity",
  "revenge",
  "fraud",
  "other",
];

export default function NewInvestigationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<InvestigationCategory>("war_misinfo");
  const [description, setDescription] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>([""]);
  const [geographicContext, setGeographicContext] = useState("");
  const [dateFirstSeen, setDateFirstSeen] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const urls = sourceUrls.filter((u) => u.trim() !== "");

    const res = await fetch("/api/admin/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        description: description || undefined,
        source_urls: urls.length > 0 ? urls : undefined,
        geographic_context: geographicContext || undefined,
        date_first_seen: dateFirstSeen || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors?.title?.[0] || "Failed to create investigation");
      setSaving(false);
      return;
    }

    const investigation = await res.json();
    router.push(`/admin/investigations/${investigation.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/investigations">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">New Investigation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Start a new deepfake investigation case
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-xl border border-border/50 p-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Fake video of president announcing martial law"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    category === cat
                      ? "bg-primary/10 text-primary border-primary/30 font-medium"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what you're investigating..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Source URLs */}
          <div className="space-y-2">
            <Label>Source URLs</Label>
            {sourceUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => {
                    const next = [...sourceUrls];
                    next[i] = e.target.value;
                    setSourceUrls(next);
                  }}
                />
                {sourceUrls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setSourceUrls(sourceUrls.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setSourceUrls([...sourceUrls, ""])}
            >
              <Plus className="h-3 w-3" />
              Add URL
            </Button>
          </div>

          {/* Geographic Context */}
          <div className="space-y-2">
            <Label htmlFor="geo">Geographic Context</Label>
            <Input
              id="geo"
              placeholder="e.g., Iran, Ukraine, Middle East"
              value={geographicContext}
              onChange={(e) => setGeographicContext(e.target.value)}
            />
          </div>

          {/* Date First Seen */}
          <div className="space-y-2">
            <Label htmlFor="date">Date First Seen</Label>
            <Input
              id="date"
              type="date"
              value={dateFirstSeen}
              onChange={(e) => setDateFirstSeen(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/admin/investigations">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? "Creating..." : "Create Investigation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
