"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, X, Check, Loader2, Plus, Trash2 } from "lucide-react";

interface ConfigEntry {
  value: unknown;
  description: string | null;
}

const LABELS: Record<string, string> = {
  cross_match_threshold: "Cross-Match Threshold",
  stock_match_threshold: "Stock Match Threshold",
  batch_size: "Batch Size",
  max_ads_per_scan: "Max Ads Per Scan",
  search_terms: "Search Terms",
  target_platforms: "Target Platforms",
  stock_platforms: "Stock Platforms",
  confidence_tiers: "Confidence Tiers",
  ai_detection_threshold: "AI Detection Threshold",
  scan_interval_minutes: "Scan Interval (min)",
};

function getLabel(key: string) {
  return LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function isArrayValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isNumberValue(value: unknown): value is number {
  return typeof value === "number";
}

export function ConfigEditor() {
  const [config, setConfig] = useState<Record<string, ConfigEntry>>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ad-intel/config");
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const startEdit = (key: string) => {
    setEditingKey(key);
    setEditValue(config[key].value);
    setNewTag("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue(null);
    setNewTag("");
  };

  const saveEdit = async (key: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ad-intel/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValue }),
      });

      if (res.ok) {
        setConfig((prev) => ({
          ...prev,
          [key]: { ...prev[key], value: editValue },
        }));
        setEditingKey(null);
        setEditValue(null);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (!newTag.trim() || !Array.isArray(editValue)) return;
    setEditValue([...editValue, newTag.trim()]);
    setNewTag("");
  };

  const removeTag = (index: number) => {
    if (!Array.isArray(editValue)) return;
    setEditValue(editValue.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const keys = Object.keys(config).sort();

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {keys.map((key) => {
            const entry = config[key];
            const isEditing = editingKey === key;

            return (
              <div
                key={key}
                className="flex items-start gap-3 p-3 rounded-md border border-border/20 bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{getLabel(key)}</p>
                  {entry.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {entry.description}
                    </p>
                  )}

                  {isEditing ? (
                    <div className="mt-2">
                      {isArrayValue(editValue) ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {editValue.map((tag, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="gap-1 pr-1"
                              >
                                {tag}
                                <button
                                  onClick={() => removeTag(i)}
                                  className="hover:text-destructive"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <Input
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              placeholder="Add item..."
                              className="h-7 text-xs flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addTag();
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={addTag}
                              disabled={!newTag.trim()}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : isNumberValue(editValue) ? (
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) =>
                            setEditValue(parseFloat(e.target.value) || 0)
                          }
                          step={editValue < 1 ? 0.01 : 1}
                          className="h-7 text-xs w-32"
                        />
                      ) : (
                        <Input
                          value={String(editValue ?? "")}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 text-xs"
                        />
                      )}

                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => saveEdit(key)}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Check className="h-3 w-3 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={cancelEdit}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      {isArrayValue(entry.value) ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.value.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground font-mono">
                          {JSON.stringify(entry.value)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => startEdit(key)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
