"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import type { OptOutCommunication } from "@/types/optout";

interface OptOutTimelineProps {
  communications: OptOutCommunication[];
}

function formatTypeName(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function OptOutTimeline({ communications }: OptOutTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sorted = [...communications].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          No communications yet.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 mt-4">
      {sorted.map((comm, i) => {
        const isLast = i === sorted.length - 1;
        const isOutbound = comm.direction === "outbound";
        const isExpanded = expandedIds.has(comm.id);

        return (
          <div key={comm.id} className="relative pb-6 last:pb-0">
            {/* Connecting line */}
            {!isLast && (
              <div
                className={`absolute left-[-18px] top-3 bottom-0 w-0.5 ${
                  isOutbound
                    ? "bg-primary/40"
                    : "border-l border-dashed border-muted-foreground/30"
                }`}
              />
            )}

            {/* Node circle */}
            <div
              className={`absolute left-[-22px] w-[9px] h-[9px] rounded-full ${
                isOutbound
                  ? "bg-primary border-2 border-primary"
                  : "bg-green-500 border-2 border-green-500"
              }`}
            />

            {/* Content */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {isOutbound ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <ArrowDownLeft className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {formatTypeName(comm.communication_type)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(comm.created_at)}
                </span>
              </div>

              {comm.subject && (
                <p className="text-sm text-muted-foreground pl-5.5">
                  {comm.subject}
                </p>
              )}

              <div className="flex items-center gap-3 pl-5.5 flex-wrap">
                <code className="text-[11px] font-mono bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded">
                  {comm.content_hash.slice(0, 12)}...
                </code>

                {isOutbound && comm.resend_message_id && (
                  <span className="flex items-center gap-1 text-[11px] text-green-500">
                    <Check className="w-3 h-3" />
                    Delivered
                  </span>
                )}

                {comm.evidence_file_path && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Paperclip className="w-3 h-3" />
                    Evidence attached
                  </span>
                )}
              </div>

              {/* Expandable content */}
              <button
                type="button"
                onClick={() => toggleExpanded(comm.id)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors pl-5.5 pt-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide content
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    View content
                  </>
                )}
              </button>

              {isExpanded && (
                <div className="ml-5.5 mt-1 p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {comm.content_text}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
