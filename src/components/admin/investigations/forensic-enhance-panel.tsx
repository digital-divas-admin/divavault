"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Microscope,
  Loader2,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { InvestigationFrame } from "@/types/investigations";

// Mirror the filter preset structure from the server-side module
interface FilterParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

interface FilterPreset {
  id: string;
  label: string;
  description: string;
  params: FilterParam[];
}

const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "sharpen",
    label: "Sharpen",
    description: "Unsharp mask to reveal hidden detail",
    params: [
      { key: "strength", label: "Strength", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
    ],
  },
  {
    id: "edge_detect",
    label: "Edge Detect",
    description: "Highlight manipulation boundaries",
    params: [
      { key: "low", label: "Low Threshold", min: 0.01, max: 0.5, step: 0.01, default: 0.1 },
      { key: "high", label: "High Threshold", min: 0.1, max: 0.8, step: 0.01, default: 0.3 },
    ],
  },
  {
    id: "denoise",
    label: "Denoise",
    description: "Remove noise to reveal structure",
    params: [
      { key: "luma", label: "Luma", min: 1, max: 20, step: 1, default: 6 },
      { key: "chroma", label: "Chroma", min: 1, max: 20, step: 1, default: 4 },
    ],
  },
  {
    id: "histogram_eq",
    label: "Histogram EQ",
    description: "Global histogram equalization",
    params: [
      { key: "strength", label: "Strength", min: 0.1, max: 1.0, step: 0.05, default: 0.5 },
      { key: "intensity", label: "Intensity", min: 0.1, max: 1.0, step: 0.05, default: 0.5 },
    ],
  },
  {
    id: "color_amplify",
    label: "Color Amplify",
    description: "Boost color to reveal inconsistencies",
    params: [
      { key: "saturation", label: "Saturation", min: 1, max: 5, step: 0.1, default: 3 },
      { key: "contrast", label: "Contrast", min: 0.5, max: 3, step: 0.1, default: 1.5 },
      { key: "brightness", label: "Brightness", min: -0.3, max: 0.3, step: 0.01, default: 0 },
    ],
  },
  {
    id: "ela",
    label: "ELA",
    description: "Error Level Analysis — detect edits",
    params: [
      { key: "quality", label: "Quality", min: 5, max: 30, step: 1, default: 15 },
      { key: "amplify", label: "Amplification", min: 5, max: 30, step: 1, default: 15 },
    ],
  },
];

interface ForensicEnhancePanelProps {
  frame: InvestigationFrame;
  investigationId: string;
  onEnhanced: (url: string) => void;
  onReset: () => void;
  onSaveEvidence: (storagePath: string, filterLabel: string, filterDescription: string) => void;
}

export function ForensicEnhancePanel({
  frame,
  investigationId,
  onEnhanced,
  onReset,
  onSaveEvidence,
}: ForensicEnhancePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enhancedStoragePath, setEnhancedStoragePath] = useState<string | null>(null);
  const [activeFilterLabel, setActiveFilterLabel] = useState<string | null>(null);
  const [activeFilterDescription, setActiveFilterDescription] = useState<string | null>(null);

  const selectFilter = useCallback((filterId: string) => {
    const preset = FILTER_PRESETS.find((f) => f.id === filterId);
    if (!preset) return;
    setSelectedFilter(filterId);
    // Set default params
    const defaults: Record<string, number> = {};
    for (const p of preset.params) {
      defaults[p.key] = p.default;
    }
    setParams(defaults);
    setError(null);
  }, []);

  async function handleApply() {
    if (!selectedFilter) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/investigations/${investigationId}/frames/${frame.id}/enhance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: selectedFilter, params }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      if (data.url) {
        onEnhanced(data.url);
        setEnhancedStoragePath(data.storage_path);
        const preset = FILTER_PRESETS.find((f) => f.id === selectedFilter);
        setActiveFilterLabel(preset?.label || selectedFilter);
        setActiveFilterDescription(preset?.description || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhancement failed");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    onReset();
    setEnhancedStoragePath(null);
    setActiveFilterLabel(null);
    setActiveFilterDescription(null);
    setSelectedFilter(null);
    setParams({});
    setError(null);
  }

  function handleSaveEvidence() {
    if (enhancedStoragePath && activeFilterLabel) {
      onSaveEvidence(enhancedStoragePath, activeFilterLabel, activeFilterDescription || "");
    }
  }

  const currentPreset = selectedFilter
    ? FILTER_PRESETS.find((f) => f.id === selectedFilter)
    : null;

  return (
    <div className="bg-card rounded-xl border border-border/50">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors rounded-xl"
      >
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Microscope className="h-4 w-4" />
          Forensic Enhancement
        </h3>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Apply forensic filters to reveal manipulation artifacts.
          </p>

          {/* Filter buttons */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => selectFilter(preset.id)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  selectedFilter === preset.id
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Parameter sliders */}
          {currentPreset && (
            <div className="space-y-3 pt-1">
              {currentPreset.params.map((paramDef) => (
                <div key={paramDef.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground">{paramDef.label}</label>
                    <span className="text-xs font-mono text-foreground">
                      {(params[paramDef.key] ?? paramDef.default).toFixed(
                        paramDef.step < 1 ? (paramDef.step < 0.1 ? 2 : 1) : 0
                      )}
                    </span>
                  </div>
                  <Slider
                    value={[params[paramDef.key] ?? paramDef.default]}
                    onValueChange={([v]) =>
                      setParams((prev) => ({ ...prev, [paramDef.key]: v }))
                    }
                    min={paramDef.min}
                    max={paramDef.max}
                    step={paramDef.step}
                  />
                </div>
              ))}

              {/* Apply button */}
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={handleApply}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Microscope className="h-3.5 w-3.5" />
                )}
                {loading ? "Applying..." : "Apply Filter"}
              </Button>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Active enhancement controls */}
          {enhancedStoragePath && (
            <div className="space-y-2 pt-1 border-t border-border/30">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                  {activeFilterLabel} Applied
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handleSaveEvidence}
                >
                  <Save className="h-3 w-3" />
                  Save as Evidence
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
