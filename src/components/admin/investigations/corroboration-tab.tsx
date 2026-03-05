"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Star, Globe, Newspaper } from "lucide-react";
import type { InvestigationDetail, ReverseSearchEngine } from "@/types/investigations";
import {
  getOutletTier,
  getCorroborationScore,
  getCorroborationBarColor,
  CORROBORATION_ENGINES,
  OUTLET_TIER_STYLES,
} from "@/lib/investigation-utils";

const ENGINE_LABELS: Partial<Record<ReverseSearchEngine, string>> = {
  news_search: "News Search",
  ap_archive: "AP Archive",
  getty_editorial: "Getty Editorial",
  manual: "Manual",
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function CorroborationTab({
  data,
  onUpdate,
}: {
  data: InvestigationDetail;
  onUpdate: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState("");
  const [engine, setEngine] = useState<ReverseSearchEngine>("news_search");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [rating, setRating] = useState<number>(3);
  const [notes, setNotes] = useState("");

  const results = useMemo(
    () => data.reverse_search_results.filter((r) => CORROBORATION_ENGINES.includes(r.engine)),
    [data.reverse_search_results]
  );

  const corroboration = useMemo(() => getCorroborationScore(results), [results]);

  const tierCounts = useMemo(() => {
    const counts = { major: 0, national: 0, local: 0, social: 0, unknown: 0 };
    for (const r of results) {
      counts[getOutletTier(r.result_domain)]++;
    }
    return counts;
  }, [results]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setSaving(true);
    try {
      const domain = extractDomain(url);
      const res = await fetch(`/api/admin/investigations/${data.id}/search-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine,
          result_url: url,
          result_domain: domain,
          result_title: title || undefined,
          result_date: date || undefined,
          relevance_rating: rating,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        setUrl("");
        setTitle("");
        setDate("");
        setRating(3);
        setNotes("");
        setShowForm(false);
        onUpdate();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(resultId: string) {
    const res = await fetch(
      `/api/admin/investigations/${data.id}/search-results/${resultId}`,
      { method: "DELETE" }
    );
    if (res.ok) onUpdate();
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Corroboration Score
          </h3>
          <span className="text-2xl font-bold text-foreground">{corroboration.score}/100</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${getCorroborationBarColor(corroboration.score)}`}
            style={{ width: `${corroboration.score}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={corroboration.score >= 70 ? "border-green-500/30 text-green-500" : corroboration.score >= 40 ? "border-amber-500/30 text-amber-500" : "border-red-500/30 text-red-500"}>
            {corroboration.label}
          </Badge>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {Object.entries(tierCounts)
              .filter(([, count]) => count > 0)
              .map(([tier, count]) => (
                <span key={tier} className="capitalize">
                  {tier}: {count}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Add button / form */}
      {!showForm ? (
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Media Source
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Add Media Source</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL *</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://apnews.com/article/..."
                required
              />
              {url && (
                <p className="text-xs text-muted-foreground mt-1">
                  Domain: {extractDomain(url) || "—"} · Tier:{" "}
                  {OUTLET_TIER_STYLES[getOutletTier(extractDomain(url))].label}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Engine</label>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as ReverseSearchEngine)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              >
                {CORROBORATION_ENGINES.map((eng) => (
                  <option key={eng} value={eng}>
                    {ENGINE_LABELS[eng] || eng}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date Found</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Relevance (1-5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="p-1"
                  >
                    <Star
                      className={`h-5 w-5 ${n <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving..." : "Add Source"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Results list */}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((r) => {
            const tier = getOutletTier(r.result_domain);
            const style = OUTLET_TIER_STYLES[tier];
            return (
              <div
                key={r.id}
                className="bg-card border border-border rounded-lg p-4 flex items-start gap-4"
              >
                <Globe className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={r.result_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground hover:text-primary truncate"
                    >
                      {r.result_title || r.result_domain || r.result_url}
                    </a>
                    <Badge variant="outline" className={style.className}>
                      {style.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {r.result_domain && <span>{r.result_domain}</span>}
                    {r.result_date && <span>{r.result_date}</span>}
                    {r.engine && <span className="capitalize">{ENGINE_LABELS[r.engine] || r.engine}</span>}
                    {r.relevance_rating && (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: r.relevance_rating }, (_, i) => (
                          <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
                        ))}
                      </span>
                    )}
                  </div>
                  {r.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(r.id)}
                  className="text-destructive hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No media sources added yet.</p>
          <p className="text-xs mt-1">Add news outlets that have used this content to build a corroboration score.</p>
        </div>
      )}
    </div>
  );
}
