"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, FileText, Image as ImageIcon, Search, Clock, Globe, ExternalLink, Pencil, Plus, Trash2, X, CheckCircle2, XCircle, Loader2, AlertTriangle, Timer, Fingerprint, Film, Monitor } from "lucide-react";
import { VerdictSelector } from "./verdict-selector";
import type { InvestigationDetail, InvestigationVerdict, InvestigationCategory, ReverseSearchEngine, DeepfakeTask, TaskType } from "@/types/investigations";
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, INVESTIGATION_CATEGORIES } from "@/types/investigations";
import { formatDuration, isAiGeneratorDuration, computeTechnicalFingerprint, getAiScoreTextColor, MIN_CANDIDATE_MATCHES } from "@/lib/investigation-utils";

function safeDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

const ENGINE_LABELS: Partial<Record<ReverseSearchEngine, string>> = {
  tineye: "TinEye",
  serpapi: "Google Lens",
  wayback: "Wayback",
  news_search: "News",
  ap_archive: "AP Archive",
  getty_editorial: "Getty Editorial",
};

interface OverviewTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

interface EditableFields {
  title: string;
  category: InvestigationCategory;
  description: string;
  geographicContext: string;
  dateFirstSeen: string;
  sourceUrls: string[];
}

function initFields(data: InvestigationDetail): EditableFields {
  return {
    title: data.title,
    category: data.category,
    description: data.description || "",
    geographicContext: data.geographic_context || "",
    dateFirstSeen: data.date_first_seen || "",
    sourceUrls: data.source_urls || [],
  };
}

export function OverviewTab({ data, onUpdate }: OverviewTabProps) {
  const [verdict, setVerdict] = useState<InvestigationVerdict | null>(data.verdict);
  const [confidence, setConfidence] = useState<number | null>(data.confidence_score);
  const [summary, setSummary] = useState(data.summary || "");
  const [methodology, setMethodology] = useState(data.methodology || "");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(() => initFields(data));

  const fingerprint = useMemo(() => {
    const video = data.media.find((m) => m.media_type === "video" && (m.duration_seconds != null || m.fps != null));
    return video ? computeTechnicalFingerprint(video) : null;
  }, [data.media]);
  const fingerprintVideo = useMemo(() => {
    return data.media.find((m) => m.media_type === "video" && (m.duration_seconds != null || m.fps != null)) ?? null;
  }, [data.media]);

  function updateField<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleCancelEdit() {
    setFields(initFields(data));
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/investigations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fields.title,
          category: fields.category,
          description: fields.description || null,
          geographic_context: fields.geographicContext || null,
          date_first_seen: fields.dateFirstSeen || null,
          source_urls: fields.sourceUrls.filter((u) => u.trim()),
          verdict,
          confidence_score: confidence,
          summary: summary || null,
          methodology: methodology || null,
        }),
      });
      if (!res.ok) {
        console.error("Failed to save investigation:", res.status);
        return;
      }
      setEditing(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header card */}
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <div className="flex items-start justify-between mb-4">
            {editing ? (
              <div className="flex-1 space-y-3">
                <Input
                  value={fields.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className="text-xl font-semibold"
                  placeholder="Investigation title"
                />
                <div className="flex items-center gap-2">
                  <Select value={fields.category} onValueChange={(v) => updateField("category", v as InvestigationCategory)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTIGATION_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className={STATUS_COLORS[data.status]}>
                    {STATUS_LABELS[data.status]}
                  </Badge>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold">{data.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{CATEGORY_LABELS[data.category]}</Badge>
                  <Badge variant="outline" className={STATUS_COLORS[data.status]}>
                    {STATUS_LABELS[data.status]}
                  </Badge>
                </div>
              </div>
            )}
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <Textarea
                  value={fields.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Investigation description..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Geographic Context</label>
                  <Input
                    value={fields.geographicContext}
                    onChange={(e) => updateField("geographicContext", e.target.value)}
                    placeholder="e.g. Ukraine, US"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date First Seen</label>
                  <Input
                    type="date"
                    value={fields.dateFirstSeen}
                    onChange={(e) => updateField("dateFirstSeen", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Source URLs</label>
                <div className="space-y-2">
                  {fields.sourceUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={url}
                        onChange={(e) => {
                          const updated = [...fields.sourceUrls];
                          updated[i] = e.target.value;
                          updateField("sourceUrls", updated);
                        }}
                        placeholder="https://..."
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => updateField("sourceUrls", fields.sourceUrls.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => updateField("sourceUrls", [...fields.sourceUrls, ""])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add URL
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save All"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {data.description && (
                <p className="text-sm text-muted-foreground">{data.description}</p>
              )}
              {data.geographic_context && (
                <p className="text-xs text-muted-foreground mt-2">
                  Region: {data.geographic_context}
                </p>
              )}
              {data.date_first_seen && (
                <p className="text-xs text-muted-foreground mt-1">
                  First seen: {data.date_first_seen}
                </p>
              )}
            </>
          )}
        </div>

        {/* Verdict */}
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="text-sm font-medium mb-4">Verdict & Confidence</h3>
          <VerdictSelector
            verdict={verdict}
            confidenceScore={confidence}
            onVerdictChange={setVerdict}
            onConfidenceChange={setConfidence}
          />
        </div>

        {/* Summary */}
        <div className="bg-card rounded-xl border border-border/50 p-6 space-y-4">
          <h3 className="text-sm font-medium">Summary</h3>
          <Textarea
            placeholder="Write a summary of the investigation findings..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
          />
          <h3 className="text-sm font-medium">Methodology</h3>
          <Textarea
            placeholder="Describe the investigation methodology..."
            value={methodology}
            onChange={(e) => setMethodology(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
          <h3 className="text-sm font-medium">Quick Stats</h3>
          <div className="space-y-2">
            <StatRow icon={<ImageIcon className="h-3.5 w-3.5" />} label="Media" value={data.media.length} />
            <StatRow icon={<FileText className="h-3.5 w-3.5" />} label="Evidence" value={data.evidence.length} />
            <StatRow icon={<Search className="h-3.5 w-3.5" />} label="Frames" value={data.frames.length} />
            {(() => {
              const totalDuration = data.media.reduce((sum, m) => sum + (m.duration_seconds || 0), 0);
              if (totalDuration <= 0) return null;
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    Duration
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{formatDuration(totalDuration)}</span>
                    {data.media.some((m) => isAiGeneratorDuration(m.duration_seconds)) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        AI length
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
            {fingerprint && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Fingerprint className="h-3.5 w-3.5" />
                    Fingerprint
                  </div>
                  <span className={`text-sm font-medium ${getAiScoreTextColor(fingerprint.normalizedScore)}`}>{fingerprint.overallScore}/100</span>
                </div>
                {fingerprintVideo?.fps != null && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Film className="h-3.5 w-3.5" />
                      FPS
                    </div>
                    <span className="text-sm font-medium">{Math.round(fingerprintVideo.fps)} fps</span>
                  </div>
                )}
                {fingerprintVideo?.resolution_width && fingerprintVideo?.resolution_height && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Monitor className="h-3.5 w-3.5" />
                      Resolution
                    </div>
                    <span className="text-sm font-medium">{fingerprintVideo.resolution_width}x{fingerprintVideo.resolution_height}</span>
                  </div>
                )}
                {fingerprint.topCandidates.length > 0 && fingerprint.topCandidates[0].matchCount >= MIN_CANDIDATE_MATCHES && (
                  <div className="pt-1">
                    <span className="text-[10px] text-muted-foreground block mb-1">Top candidates</span>
                    <div className="flex flex-wrap gap-1">
                      {fingerprint.topCandidates.filter((c) => c.matchCount >= MIN_CANDIDATE_MATCHES).slice(0, 3).map((c) => (
                        <span key={c.name} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                          {c.name} ({c.matchCount}/3)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="Active Tasks" value={data.tasks.filter((t) => t.status === "running" || t.status === "pending").length} />
          </div>
        </div>

        {/* Recent Tasks */}
        <RecentTasksSection tasks={data.tasks} />

        {/* Activity Feed */}
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <h3 className="text-sm font-medium mb-3">Recent Activity</h3>
          {data.activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {data.activity.slice(0, 10).map((entry) => (
                <div key={entry.id} className="text-xs">
                  <span className="text-foreground">
                    {entry.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source URLs */}
        {data.source_urls.length > 0 && (
          <div className="bg-card rounded-xl border border-border/50 p-5">
            <h3 className="text-sm font-medium mb-3">Source URLs</h3>
            <div className="space-y-1.5">
              {data.source_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-primary hover:underline truncate"
                >
                  {url}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Earliest Known Source */}
        {(() => {
          const earliest = data.reverse_search_results
            .filter((r) => r.result_date)
            .sort((a, b) => (a.result_date || "").localeCompare(b.result_date || ""))[0];
          if (!earliest) return null;
          return (
            <div className="bg-card rounded-xl border border-border/50 p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Earliest Known Source
              </h3>
              <div className="space-y-2">
                <a
                  href={earliest.result_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {earliest.result_domain || safeDomain(earliest.result_url)}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {earliest.result_title && (
                  <p className="text-xs text-muted-foreground">{earliest.result_title}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  First seen: {earliest.result_date}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {ENGINE_LABELS[earliest.engine] || earliest.engine}
                </Badge>
              </div>
            </div>
          );
        })()}

        {/* All Search Results */}
        {data.reverse_search_results.length > 0 && (() => {
          const grouped = data.reverse_search_results.reduce<Record<string, typeof data.reverse_search_results>>((acc, r) => {
            const key = r.engine;
            if (!acc[key]) acc[key] = [];
            acc[key].push(r);
            return acc;
          }, {});
          return (
            <div className="bg-card rounded-xl border border-border/50 p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Results
              </h3>
              <div className="space-y-4">
                {Object.entries(grouped).map(([engine, results]) => (
                  <div key={engine}>
                    <Badge variant="outline" className="text-[10px] mb-2">
                      {ENGINE_LABELS[engine as ReverseSearchEngine] || engine}
                    </Badge>
                    <div className="space-y-1.5">
                      {results.map((r) => (
                        <div key={r.id} className="text-xs">
                          <a
                            href={r.result_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {r.result_title || r.result_domain || safeDomain(r.result_url)}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                            {r.result_date && <span>{r.result_date}</span>}
                            {r.result_domain && <span>{r.result_domain}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  download_media: "Download Media",
  extract_frames: "Extract Frames",
  extract_metadata: "Extract Metadata",
  reverse_search: "Reverse Search",
  ai_detection: "AI Detection",
  check_provenance: "Provenance Check",
  news_search: "News Search",
  wire_search: "AP / Getty Check",
};

function RecentTasksSection({ tasks }: { tasks: DeepfakeTask[] }) {
  // Show completed, failed, running, and pending tasks — most recent first
  const recent = [...tasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  if (recent.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Recent Tasks
      </h3>
      <div className="space-y-2">
        {recent.map((task) => {
          const resultObj = task.result as Record<string, unknown> | null;
          const skipped = Boolean(resultObj?.skipped);
          const skipReason = skipped && typeof resultObj?.reason === "string" ? resultObj.reason : null;

          return (
            <div key={task.id} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5 shrink-0">
                {task.status === "completed" && !skipped && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                )}
                {task.status === "completed" && skipped && (
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                )}
                {task.status === "failed" && (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
                {task.status === "running" && (
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                )}
                {task.status === "pending" && (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">
                    {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                  </span>
                  {task.status === "running" && task.progress != null && task.progress > 0 && (
                    <span className="text-muted-foreground">{task.progress}%</span>
                  )}
                </div>
                {task.status === "failed" && task.error_message && (
                  <p className="text-red-400 mt-0.5 break-words">{task.error_message}</p>
                )}
                {skipped && skipReason && (
                  <p className="text-yellow-400/80 mt-0.5 break-words">{skipReason}</p>
                )}
                <span className="text-muted-foreground">
                  {new Date(task.created_at).toLocaleDateString()}{" "}
                  {new Date(task.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
