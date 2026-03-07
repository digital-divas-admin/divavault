"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Star, Globe, Newspaper, Eye, Check, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react";
import type { InvestigationDetail, ReverseSearchResult, ReverseSearchEngine, TaskType } from "@/types/investigations";
import {
  getOutletTier,
  getCorroborationScore,
  getCorroborationBarColor,
  extractDomain,
  parseTriageNote,
  CORROBORATION_ENGINES,
  OUTLET_TIER_STYLES,
  type OutletTier,
} from "@/lib/investigation-utils";

const ENGINE_LABELS: Partial<Record<ReverseSearchEngine, string>> = {
  news_search: "News Search",
  wire_search: "Wire Service",
  google_lens: "Visual Match",
  ap_archive: "AP Archive",
  getty_editorial: "Getty Editorial",
  manual: "Manual",
};

const ENGINE_ICONS: Partial<Record<ReverseSearchEngine, typeof Newspaper>> = {
  news_search: Newspaper,
  wire_search: Globe,
  google_lens: Eye,
};

type TierFilter = "all" | "news" | "social";

function isNewsTier(tier: OutletTier): boolean {
  return tier === "major" || tier === "national" || tier === "local";
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
  const [tierFilter, setTierFilter] = useState<TierFilter>("news");
  const [expandedEngines, setExpandedEngines] = useState<Set<string>>(new Set(["google_lens", "news_search"]));
  const [triaging, setTriaging] = useState(false);

  const allResults = useMemo(
    () => data.reverse_search_results.filter((r) => CORROBORATION_ENGINES.includes(r.engine)),
    [data.reverse_search_results]
  );

  // Split into confirmed (has relevance_rating) and unreviewed
  const confirmed = useMemo(() => allResults.filter((r) => r.relevance_rating != null), [allResults]);
  const unreviewed = useMemo(() => allResults.filter((r) => r.relevance_rating == null), [allResults]);

  // Score only counts confirmed results
  const corroboration = useMemo(() => getCorroborationScore(confirmed), [confirmed]);

  const confirmedTierCounts = useMemo(() => {
    const counts = { major: 0, national: 0, local: 0, social: 0, unknown: 0 };
    for (const r of confirmed) {
      counts[getOutletTier(r.result_domain)]++;
    }
    return counts;
  }, [confirmed]);

  // Group unreviewed by engine
  const unreviewedByEngine = useMemo(() => {
    const grouped: Record<string, ReverseSearchResult[]> = {};
    for (const r of unreviewed) {
      const key = r.engine;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    return grouped;
  }, [unreviewed]);

  // AI-triaged high-relevance results (from unreviewed pool)
  const aiSuggested = useMemo(
    () => unreviewed.filter((r) => parseTriageNote(r.notes)?.relevance === "high"),
    [unreviewed]
  );

  async function handleAiTriage() {
    setTriaging(true);
    try {
      await fetch(`/api/admin/investigations/${data.id}/ai-triage`, {
        method: "POST",
      });
      onUpdate();
    } finally {
      setTriaging(false);
    }
  }

  // Filter unreviewed by engine + tier
  const filteredByEngine = useMemo(() => {
    const result: Record<string, ReverseSearchResult[]> = {};
    for (const [eng, results] of Object.entries(unreviewedByEngine)) {
      const filtered = tierFilter === "all"
        ? results
        : results.filter((r) => {
            const tier = getOutletTier(r.result_domain);
            return tierFilter === "news" ? isNewsTier(tier) : tier === "social";
          });
      if (filtered.length > 0) result[eng] = filtered;
    }
    return result;
  }, [unreviewedByEngine, tierFilter]);

  async function handleConfirm(resultId: string) {
    await fetch(`/api/admin/investigations/${data.id}/search-results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relevance_rating: 5 }),
    });
    onUpdate();
  }

  async function handleDelete(resultId: string) {
    await fetch(`/api/admin/investigations/${data.id}/search-results/${resultId}`, {
      method: "DELETE",
    });
    onUpdate();
  }

  async function handleRemoveConfirmed(resultId: string) {
    await fetch(`/api/admin/investigations/${data.id}/search-results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relevance_rating: null }),
    });
    onUpdate();
  }

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

  function toggleEngine(engine: string) {
    setExpandedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(engine)) next.delete(engine);
      else next.add(engine);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Search Trigger Buttons */}
      <div className="flex gap-2 flex-wrap">
        <CorroborationTriggerButton
          investigationId={data.id}
          taskType="news_search"
          label="News Search"
          icon={<Newspaper className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
        <CorroborationTriggerButton
          investigationId={data.id}
          taskType="wire_search"
          label="Wire Service Check"
          icon={<Globe className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
        <CorroborationTriggerButton
          investigationId={data.id}
          taskType="visual_search"
          label="Visual Search"
          icon={<Eye className="h-3.5 w-3.5" />}
          onUpdate={onUpdate}
        />
        <Button size="sm" variant="outline" className="gap-2" onClick={handleAiTriage} disabled={triaging}>
          <Sparkles className="h-3.5 w-3.5" />
          {triaging ? "Triaging..." : "AI Triage"}
        </Button>
      </div>

      {/* Corroboration Score — based on confirmed sources only */}
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
            <span>{confirmed.length} confirmed source{confirmed.length !== 1 ? "s" : ""}</span>
            {Object.entries(confirmedTierCounts)
              .filter(([, count]) => count > 0)
              .map(([tier, count]) => (
                <span key={tier} className="capitalize">
                  {tier}: {count}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Confirmed Sources */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Confirmed Sources
          </h3>
          <Button onClick={() => setShowForm(true)} size="sm" variant="outline" className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add Manual
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4 mb-4">
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
                    <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                      <Star className={`h-5 w-5 ${n <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
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

        {confirmed.length > 0 ? (
          <div className="space-y-2">
            {confirmed.map((r) => (
              <ResultRow key={r.id} result={r} onDelete={handleDelete} onRemove={handleRemoveConfirmed} confirmed />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground bg-card border border-border/50 rounded-xl">
            <p className="text-sm">No confirmed sources yet.</p>
            <p className="text-xs mt-1">Confirm results from the searches below or add sources manually.</p>
          </div>
        )}
      </div>

      {/* AI Suggested */}
      {aiSuggested.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-400" />
            AI Suggested
            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
              {aiSuggested.length} high relevance
            </Badge>
          </h3>
          <div className="space-y-2">
            {aiSuggested.map((r) => (
              <ResultRow key={r.id} result={r} onConfirm={handleConfirm} onDismiss={handleDelete} highlighted />
            ))}
          </div>
        </div>
      )}

      {/* Unreviewed Search Results */}
      {unreviewed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Search Results
              <span className="text-muted-foreground font-normal ml-2">({unreviewed.length} unreviewed)</span>
            </h3>
            <div className="flex gap-1">
              {(["all", "news", "social"] as TierFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTierFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    tierFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f === "news" ? "News Only" : "Social"}
                </button>
              ))}
            </div>
          </div>

          {Object.entries(filteredByEngine).map(([eng, filtered]) => {
            const isExpanded = expandedEngines.has(eng);
            const Icon = ENGINE_ICONS[eng as ReverseSearchEngine] || Globe;
            const label = ENGINE_LABELS[eng as ReverseSearchEngine] || eng;

            return (
              <div key={eng} className="mb-4">
                <button
                  onClick={() => toggleEngine(eng)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors mb-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {filtered.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-1.5">
                    {filtered.map((r) => (
                      <ResultRow key={r.id} result={r} onConfirm={handleConfirm} onDismiss={handleDelete} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result: r,
  confirmed,
  highlighted,
  onConfirm,
  onDismiss,
  onDelete,
  onRemove,
}: {
  result: ReverseSearchResult;
  confirmed?: boolean;
  highlighted?: boolean;
  onConfirm?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const tier = getOutletTier(r.result_domain);
  const style = OUTLET_TIER_STYLES[tier];
  const triage = parseTriageNote(r.notes);

  return (
    <div className={`bg-card border rounded-lg p-3 flex items-center gap-3 ${confirmed ? "border-green-500/20" : highlighted ? "border-purple-500/20" : "border-border"} ${triage?.relevance === "low" ? "opacity-50" : ""}`}>
      {r.thumbnail_url && (
        <a href={r.result_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          <img
            src={r.thumbnail_url}
            alt=""
            className="h-14 w-20 rounded object-cover bg-muted"
          />
        </a>
      )}
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
          {confirmed && (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
              Confirmed
            </Badge>
          )}
          {triage && (
            <Badge
              variant="outline"
              className={
                triage.relevance === "high"
                  ? "bg-green-500/10 text-green-500 border-green-500/20 text-[10px]"
                  : triage.relevance === "medium"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]"
                    : "bg-muted text-muted-foreground text-[10px]"
              }
              title={triage.reason}
            >
              {triage.relevance === "high" ? "High" : triage.relevance === "medium" ? "Medium" : "Low"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {r.result_domain && <span>{r.result_domain}</span>}
          {r.engine && <span>{ENGINE_LABELS[r.engine] || r.engine}</span>}
          {r.relevance_rating && (
            <span className="flex items-center gap-0.5">
              {Array.from({ length: r.relevance_rating }, (_, i) => (
                <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
              ))}
            </span>
          )}
        </div>
        {highlighted && triage?.reason && (
          <p className="text-xs text-purple-300 mt-1">{triage.reason}</p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {onConfirm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfirm(r.id)}
            className="text-green-500 hover:text-green-400 hover:bg-green-500/10 h-8 w-8 p-0"
            title="Confirm — add to corroboration score"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(r.id)}
            className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(r.id)}
            className="text-muted-foreground hover:text-amber-500 h-8 w-8 p-0"
            title="Unconfirm — move back to unreviewed"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {onDelete && confirmed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(r.id)}
            className="text-destructive hover:text-destructive h-8 w-8 p-0"
            title="Delete permanently"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CorroborationTriggerButton({
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
