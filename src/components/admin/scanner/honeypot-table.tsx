"use client";

import type { HoneypotItem } from "@/lib/scanner-command-queries";

interface HoneypotTableProps {
  items: HoneypotItem[];
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const color =
    difficulty === "hard"
      ? "bg-red-500/10 text-red-400"
      : difficulty === "medium"
        ? "bg-yellow-500/10 text-yellow-400"
        : "bg-green-500/10 text-green-400";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${color}`}>
      {difficulty}
    </span>
  );
}

function DetectionBadge({ detected }: { detected: boolean | null }) {
  if (detected === true) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
        DETECTED
      </span>
    );
  }
  if (detected === false) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
        MISSED
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/20 text-muted-foreground">
      PENDING
    </span>
  );
}

function formatDuration(plantedAt: string | null, detectedAt: string | null): string {
  if (!plantedAt || !detectedAt) return "—";
  const diff = new Date(detectedAt).getTime() - new Date(plantedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function HoneypotTable({ items }: HoneypotTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No honeypot items planted yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 text-muted-foreground text-xs">
            <th className="py-2 px-3 text-left">Platform</th>
            <th className="py-2 px-3 text-left">Content Type</th>
            <th className="py-2 px-3 text-left">Source URL</th>
            <th className="py-2 px-3 text-center">Difficulty</th>
            <th className="py-2 px-3 text-center">Status</th>
            <th className="py-2 px-3 text-right">Similarity</th>
            <th className="py-2 px-3 text-right">Time to Detect</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-border/20 hover:bg-muted/10 transition-colors"
            >
              <td className="py-2 px-3 capitalize font-medium">
                {item.platform}
              </td>
              <td className="py-2 px-3 text-muted-foreground">
                {item.content_type}
              </td>
              <td className="py-2 px-3 max-w-[200px]">
                {item.planted_url ? (
                  <a
                    href={item.planted_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 truncate block text-xs"
                    title={item.planted_url}
                  >
                    {item.planted_url}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
              <td className="py-2 px-3 text-center">
                <DifficultyBadge difficulty={item.difficulty} />
              </td>
              <td className="py-2 px-3 text-center">
                <DetectionBadge detected={item.detected} />
              </td>
              <td className="py-2 px-3 text-right font-[family-name:var(--font-mono)] text-xs">
                {item.detected_similarity !== null
                  ? `${(item.detected_similarity * 100).toFixed(1)}%`
                  : "—"}
              </td>
              <td className="py-2 px-3 text-right font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                {formatDuration(item.planted_at, item.detected_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
