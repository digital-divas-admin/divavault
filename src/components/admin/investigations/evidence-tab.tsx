"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  FileText,
  MessageSquare,
  Link2,
  Camera,
  AlertTriangle,
  Clock,
  Search,
  Bot,
  ShieldCheck,
  Pencil,
  Save,
} from "lucide-react";
import type {
  InvestigationDetail,
  InvestigationEvidence,
  EvidenceType,
} from "@/types/investigations";
import { EVIDENCE_TYPE_LABELS } from "@/types/investigations";

const evidenceTypeIcons: Record<EvidenceType, React.ReactNode> = {
  finding: <FileText className="h-4 w-4 text-primary" />,
  note: <MessageSquare className="h-4 w-4 text-blue-500" />,
  external_link: <Link2 className="h-4 w-4 text-green-500" />,
  screenshot: <Camera className="h-4 w-4 text-purple-500" />,
  metadata_anomaly: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  timeline_entry: <Clock className="h-4 w-4 text-orange-500" />,
  source_match: <Search className="h-4 w-4 text-teal-500" />,
  ai_detection: <Bot className="h-4 w-4 text-cyan-500" />,
  provenance_check: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
};

interface EvidenceTabProps {
  data: InvestigationDetail;
  onUpdate: () => void;
}

export function EvidenceTab({ data, onUpdate }: EvidenceTabProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {/* Add evidence button */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">
          Evidence ({data.evidence.length})
        </h3>
        <Button
          size="sm"
          variant={showForm ? "outline" : "default"}
          className="gap-2"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Add Evidence"}
        </Button>
      </div>

      {/* Add evidence form */}
      {showForm && (
        <AddEvidenceForm
          investigationId={data.id}
          onAdded={() => {
            setShowForm(false);
            onUpdate();
          }}
        />
      )}

      {/* Evidence list */}
      {data.evidence.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No evidence added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.evidence.map((ev) => (
            <EvidenceCard
              key={ev.id}
              evidence={ev}
              investigationId={data.id}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceCard({
  evidence,
  investigationId,
  onUpdate,
}: {
  evidence: InvestigationEvidence;
  investigationId: string;
  onUpdate: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(evidence.title || "");
  const [editContent, setEditContent] = useState(evidence.content || "");
  const [editUrl, setEditUrl] = useState(evidence.external_url || "");
  const [saving, setSaving] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this evidence item?")) return;
    setDeleting(true);
    await fetch(
      `/api/admin/investigations/${investigationId}/evidence/${evidence.id}`,
      { method: "DELETE" }
    );
    onUpdate();
  }

  async function handleSave() {
    setSaving(true);
    await fetch(
      `/api/admin/investigations/${investigationId}/evidence/${evidence.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle || null,
          content: editContent || null,
          external_url: editUrl || null,
        }),
      }
    );
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="shrink-0 mt-0.5">
          {evidenceTypeIcons[evidence.evidence_type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">
              {EVIDENCE_TYPE_LABELS[evidence.evidence_type]}
            </Badge>
            {!editing && evidence.title && (
              <span className="text-sm font-medium">{evidence.title}</span>
            )}
          </div>

          {editing ? (
            <div className="space-y-3 mt-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Evidence title..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Content / Analysis</label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write your analysis or description..."
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">External URL</label>
                <Input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setEditTitle(evidence.title || "");
                    setEditContent(evidence.content || "");
                    setEditUrl(evidence.external_url || "");
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {evidence.content && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {evidence.content}
                </p>
              )}
              {evidence.attachment_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={evidence.attachment_url}
                  alt={evidence.title || "Evidence attachment"}
                  className="w-full max-h-60 object-contain bg-black rounded-lg mt-2"
                />
              )}
              {evidence.external_url && (
                <a
                  href={evidence.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                >
                  {evidence.external_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                {new Date(evidence.created_at).toLocaleString()}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!editing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddEvidenceForm({
  investigationId,
  onAdded,
}: {
  investigationId: string;
  onAdded: () => void;
}) {
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("finding");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const types: EvidenceType[] = [
    "finding",
    "note",
    "external_link",
    "metadata_anomaly",
    "timeline_entry",
    "source_match",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/admin/investigations/${investigationId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence_type: evidenceType,
        title: title || undefined,
        content: content || undefined,
        external_url: externalUrl || undefined,
      }),
    });
    setSaving(false);
    onAdded();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card rounded-xl border border-border/50 p-5 space-y-4"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Type</label>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEvidenceType(t)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                evidenceType === t
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {evidenceTypeIcons[t]}
              {EVIDENCE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input
          placeholder="Evidence title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Content</label>
        <Textarea
          placeholder="Describe this evidence..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
      </div>

      {(evidenceType === "external_link" || evidenceType === "source_match") && (
        <div className="space-y-2">
          <label className="text-sm font-medium">External URL</label>
          <Input
            placeholder="https://..."
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Adding..." : "Add Evidence"}
        </Button>
      </div>
    </form>
  );
}
