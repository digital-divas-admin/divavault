"use client";

import { useState, Fragment } from "react";
import type { SectionProfile } from "@/lib/scanner-command-queries";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface SectionTableProps {
  sections: SectionProfile[];
}

function RiskDot({ level }: { level: string | null }) {
  const color =
    level === "high"
      ? "bg-red-500"
      : level === "medium"
        ? "bg-yellow-500"
        : "bg-green-500";
  return <div className={`w-2 h-2 rounded-full ${color}`} title={level || "low"} />;
}

export function SectionTable({ sections }: SectionTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleToggle(section: SectionProfile) {
    const newVal = !(optimistic[section.id] ?? section.scan_enabled ?? false);
    setOptimistic((prev) => ({ ...prev, [section.id]: newVal }));

    try {
      const res = await fetch(
        `/api/admin/scanner/sections/${section.id}/toggle`,
        { method: "PATCH" }
      );
      if (!res.ok) {
        // Revert on failure
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[section.id];
          return next;
        });
      }
    } catch {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[section.id];
        return next;
      });
    }
  }

  if (sections.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No sections profiled for this platform yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 text-muted-foreground text-xs">
            <th className="py-2 px-2 text-left w-10">Scan</th>
            <th className="py-2 px-2 text-left">Section</th>
            <th className="py-2 px-2 text-left w-32">ML Priority</th>
            <th className="py-2 px-2 text-right w-16">Total</th>
            <th className="py-2 px-2 text-right w-16">Faces</th>
            <th className="py-2 px-2 text-right w-20">Face Rate</th>
            <th className="py-2 px-2 text-center w-14">Risk</th>
            <th className="py-2 px-2 text-right w-20">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const isEnabled =
              optimistic[section.id] ?? section.scan_enabled ?? false;
            const isExpanded = expanded.has(section.id);
            const coverage =
              section.total_content && section.total_scanned
                ? Math.round(
                    (section.total_scanned / section.total_content) * 100
                  )
                : 0;
            const hasAiRec = !!section.ai_recommendation;

            return (
              <Fragment key={section.id}>
                <tr
                  className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                >
                  <td className="py-2 px-2">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggle(section)}
                      className="scale-75"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      {hasAiRec && (
                        <button
                          onClick={() => toggleExpand(section.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <span className="font-medium text-foreground">
                        {section.section_name || section.section_key}
                      </span>
                      {hasAiRec && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-0.5">
                          <Brain className="h-2.5 w-2.5" />
                          AI
                        </span>
                      )}
                      {section.human_override && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                          override
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.min((section.ml_priority || 0) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-[family-name:var(--font-mono)] text-muted-foreground w-8 text-right">
                        {((section.ml_priority || 0) * 100).toFixed(0)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-[family-name:var(--font-mono)] text-xs">
                    {(section.total_content || 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right font-[family-name:var(--font-mono)] text-xs">
                    {(section.total_faces || 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right font-[family-name:var(--font-mono)] text-xs">
                    {section.face_rate !== null
                      ? `${(section.face_rate * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex justify-center">
                      <RiskDot level={section.ml_risk_level} />
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-[family-name:var(--font-mono)] text-xs">
                    <span
                      className={
                        coverage < 30 ? "text-red-400" : "text-foreground"
                      }
                    >
                      {coverage}%
                    </span>
                  </td>
                </tr>
                {isExpanded && section.ai_reason && (
                  <tr>
                    <td colSpan={8} className="px-4 py-2 bg-muted/10">
                      <div className="flex items-start gap-2 text-xs">
                        <Brain className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-muted-foreground">
                            <span className="text-primary font-medium">
                              AI Recommendation:
                            </span>{" "}
                            {section.ai_recommendation}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            {section.ai_reason}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
