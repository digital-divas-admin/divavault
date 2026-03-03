"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, FileText, Image, Search, Clock, Globe, ExternalLink } from "lucide-react";
import { VerdictSelector } from "./verdict-selector";
import type { InvestigationDetail, InvestigationVerdict, ReverseSearchEngine } from "@/types/investigations";
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS } from "@/types/investigations";

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

export function OverviewTab({ data, onUpdate }: OverviewTabProps) {
  const [verdict, setVerdict] = useState<InvestigationVerdict | null>(data.verdict);
  const [confidence, setConfidence] = useState<number | null>(data.confidence_score);
  const [summary, setSummary] = useState(data.summary || "");
  const [methodology, setMethodology] = useState(data.methodology || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/investigations/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict,
        confidence_score: confidence,
        summary: summary || null,
        methodology: methodology || null,
      }),
    });
    setSaving(false);
    onUpdate();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header card */}
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">{data.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{CATEGORY_LABELS[data.category]}</Badge>
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[data.status]}
                >
                  {STATUS_LABELS[data.status]}
                </Badge>
              </div>
            </div>
          </div>
          {data.description && (
            <p className="text-sm text-muted-foreground">{data.description}</p>
          )}
          {data.geographic_context && (
            <p className="text-xs text-muted-foreground mt-2">
              Region: {data.geographic_context}
            </p>
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
            <StatRow icon={<Image className="h-3.5 w-3.5" />} label="Media" value={data.media.length} />
            <StatRow icon={<FileText className="h-3.5 w-3.5" />} label="Evidence" value={data.evidence.length} />
            <StatRow icon={<Search className="h-3.5 w-3.5" />} label="Frames" value={data.frames.length} />
            <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="Active Tasks" value={data.tasks.filter((t) => t.status === "running" || t.status === "pending").length} />
          </div>
        </div>

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
                  {earliest.result_domain || new URL(earliest.result_url).hostname}
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
  value: number;
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
