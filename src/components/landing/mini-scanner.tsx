"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "Match Found" | "Takedown Filed" | "Removed" | "Scanning..." | "Clear";

interface Platform {
  name: string;
  icon: string;
  confidenceRange: [number, number];
  possibleStatuses: Status[];
}

const PLATFORMS: Platform[] = [
  { name: "CivitAI", icon: "CI", confidenceRange: [88, 97], possibleStatuses: ["Match Found", "Takedown Filed"] },
  { name: "Reddit", icon: "Re", confidenceRange: [85, 94], possibleStatuses: ["Match Found", "Removed"] },
  { name: "DeviantArt", icon: "DA", confidenceRange: [82, 95], possibleStatuses: ["Takedown Filed", "Match Found"] },
  { name: "Instagram", icon: "IG", confidenceRange: [90, 98], possibleStatuses: ["Scanning...", "Match Found"] },
  { name: "Midjourney", icon: "MJ", confidenceRange: [86, 96], possibleStatuses: ["Match Found", "Takedown Filed"] },
  { name: "Stable Diffusion", icon: "SD", confidenceRange: [83, 93], possibleStatuses: ["Scanning...", "Match Found"] },
  { name: "X / Twitter", icon: "X", confidenceRange: [80, 91], possibleStatuses: ["Clear", "Match Found"] },
  { name: "Hugging Face", icon: "HF", confidenceRange: [87, 95], possibleStatuses: ["Takedown Filed", "Removed"] },
  { name: "ArtStation", icon: "AS", confidenceRange: [84, 94], possibleStatuses: ["Scanning...", "Clear"] },
  { name: "Flux2", icon: "F2", confidenceRange: [86, 95], possibleStatuses: ["Takedown Filed", "Match Found"] },
];

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  "Match Found": { bg: "bg-red-500/10", text: "text-red-500" },
  "Scanning...": { bg: "bg-blue-500/10", text: "text-blue-400" },
  "Removed": { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  "Takedown Filed": { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  "Clear": { bg: "bg-[#3A5070]/10", text: "text-[#6A80A0]" },
};

function randomInRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface DisplayRow {
  key: string;
  platform: Platform;
  confidence: number;
  status: Status;
  fresh: boolean;
}

function generateRow(platform: Platform, fresh: boolean): DisplayRow {
  return {
    key: `${platform.name}-${Date.now()}-${Math.random()}`,
    platform,
    confidence: randomInRange(platform.confidenceRange[0], platform.confidenceRange[1]),
    status: platform.possibleStatuses[Math.floor(Math.random() * platform.possibleStatuses.length)],
    fresh,
  };
}

const VISIBLE_COUNT = 4;

const INITIAL_ROWS: DisplayRow[] = PLATFORMS.slice(0, VISIBLE_COUNT).map((p, i) => ({
  key: `${p.name}-initial-${i}`,
  platform: p,
  confidence: Math.round((p.confidenceRange[0] + p.confidenceRange[1]) / 2),
  status: p.possibleStatuses[0],
  fresh: false,
}));

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function MiniScanner() {
  const reducedMotion = useReducedMotion();
  const nextIndexRef = useRef(VISIBLE_COUNT);
  const [rows, setRows] = useState<DisplayRow[]>(INITIAL_ROWS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
      setRows(PLATFORMS.slice(0, VISIBLE_COUNT).map((p) => generateRow(p, false)));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const cycleRow = useCallback(() => {
    setRows((prev) => {
      const idx = nextIndexRef.current % PLATFORMS.length;
      nextIndexRef.current = idx + 1;
      const newRow = generateRow(PLATFORMS[idx], true);
      return [newRow, ...prev.slice(0, VISIBLE_COUNT - 1)];
    });
  }, []);

  useEffect(() => {
    if (reducedMotion || !mounted) return;
    const id = setInterval(cycleRow, 3000);
    return () => clearInterval(id);
  }, [reducedMotion, cycleRow, mounted]);

  return (
    <div className="bg-[#0C1424] rounded-2xl p-4 sm:p-5 shadow-2xl">
      {/* Label + LIVE indicator */}
      <div className="flex items-center gap-2 mb-3">
        <p className="font-[family-name:var(--font-mono)] text-[10px] sm:text-xs font-medium text-[#6A80A0] uppercase tracking-wider">
          Live Scanner Feed
        </p>
        <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-emerald-400">
          <span className="relative flex h-2 w-2">
            {!reducedMotion && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          LIVE
        </span>
      </div>

      {/* Platform rows */}
      <div className="divide-y divide-white/5">
        {rows.map((row) => {
          const colors = STATUS_COLORS[row.status];
          return (
            <div
              key={row.key}
              className={cn(
                "flex items-center gap-2.5 py-2.5 px-1",
                row.fresh && !reducedMotion && "animate-in fade-in slide-in-from-top-2 duration-500"
              )}
            >
              {/* Platform icon */}
              <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#6A80A0]">
                  {row.platform.icon}
                </span>
              </div>

              {/* Platform name */}
              <span className="text-sm font-medium text-white/90 truncate flex-1 min-w-0">
                {row.platform.name}
              </span>

              {/* Confidence (hidden on very small) */}
              <span className="hidden sm:inline text-xs text-[#6A80A0] tabular-nums">
                {row.confidence}%
              </span>

              {/* Status badge */}
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-medium px-2.5 py-1 rounded-full min-w-[80px] sm:min-w-[100px] text-center",
                  colors.bg,
                  colors.text
                )}
              >
                {row.status === "Scanning..." && (
                  <span className="relative inline-flex h-1.5 w-1.5 mr-1 align-middle">
                    {!reducedMotion && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    )}
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
                  </span>
                )}
                {row.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
