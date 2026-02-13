"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  { name: "TikTok", icon: "TT", confidenceRange: [79, 92], possibleStatuses: ["Clear", "Scanning..."] },
  { name: "Midjourney", icon: "MJ", confidenceRange: [86, 96], possibleStatuses: ["Match Found", "Takedown Filed"] },
  { name: "Stable Diffusion", icon: "SD", confidenceRange: [83, 93], possibleStatuses: ["Scanning...", "Match Found"] },
  { name: "X / Twitter", icon: "X", confidenceRange: [80, 91], possibleStatuses: ["Clear", "Match Found"] },
  { name: "Hugging Face", icon: "HF", confidenceRange: [87, 95], possibleStatuses: ["Takedown Filed", "Removed"] },
  { name: "ArtStation", icon: "AS", confidenceRange: [84, 94], possibleStatuses: ["Scanning...", "Clear"] },
  { name: "Nano Banana Pro", icon: "NB", confidenceRange: [81, 93], possibleStatuses: ["Scanning...", "Match Found"] },
  { name: "Seedream 4.5", icon: "Se", confidenceRange: [84, 96], possibleStatuses: ["Match Found", "Takedown Filed"] },
  { name: "Z-Image", icon: "ZI", confidenceRange: [80, 91], possibleStatuses: ["Match Found", "Scanning..."] },
  { name: "Flux2", icon: "F2", confidenceRange: [86, 95], possibleStatuses: ["Takedown Filed", "Match Found"] },
];

const STATUS_VARIANT: Record<Status, "success" | "warning" | "purple" | "secondary"> = {
  "Removed": "success",
  "Takedown Filed": "success",
  "Match Found": "warning",
  "Scanning...": "purple",
  "Clear": "secondary",
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

const VISIBLE_COUNT = 5;

// Deterministic initial rows for SSR (no Math.random/Date.now)
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

export function LiveScanner() {
  const reducedMotion = useReducedMotion();
  const scannerRef = useRef<HTMLDivElement>(null);
  const nextIndexRef = useRef(VISIBLE_COUNT);

  const [rows, setRows] = useState<DisplayRow[]>(INITIAL_ROWS);
  const [mounted, setMounted] = useState(false);

  // Randomize rows after mount to avoid hydration mismatch
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
      setRows(PLATFORMS.slice(0, VISIBLE_COUNT).map((p) => generateRow(p, false)));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Set --scanner-height via ResizeObserver
  useEffect(() => {
    const el = scannerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      el.style.setProperty("--scanner-height", `${entry.contentRect.height}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cycle platforms every 3s
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
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-8">
          {/* Header stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-6 pb-6 border-b border-border">
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-bold">247+</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground mt-1">Platforms Monitored</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-bold text-primary">24/7</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground mt-1">Scanning</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-bold text-accent">Auto</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground mt-1">Takedowns</p>
            </div>
          </div>

          {/* Label + LIVE indicator */}
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Live Scanner Feed
            </p>
            <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-accent">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              LIVE
            </span>
          </div>

          {/* Scanner area */}
          <div ref={scannerRef} className="relative overflow-hidden rounded-lg">
            {/* Scan line */}
            {!reducedMotion && (
              <div
                className="scanner-line absolute top-0 left-0 right-0 h-[2px] z-10 pointer-events-none"
                aria-hidden="true"
              />
            )}

            {/* Platform rows */}
            <div className="divide-y divide-border/50">
              {rows.map((row, i) => (
                <div
                  key={row.key}
                  className={cn(
                    "flex items-center gap-2.5 sm:gap-3 py-2 px-2.5 sm:py-3 sm:px-3 border-l-2 border-l-transparent",
                    !reducedMotion && "scanner-row-highlight",
                    row.fresh && !reducedMotion && "animate-in fade-in slide-in-from-top-2 duration-500"
                  )}
                  style={
                    !reducedMotion
                      ? { animationDelay: `${i * 0.4}s` }
                      : undefined
                  }
                >
                  {/* Platform icon */}
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">
                      {row.platform.icon}
                    </span>
                  </div>

                  {/* Platform name */}
                  <span className="text-sm font-medium truncate flex-1 min-w-0">
                    {row.platform.name}
                  </span>

                  {/* Confidence (hidden on mobile) */}
                  <span className="hidden sm:inline text-sm text-muted-foreground tabular-nums">
                    {row.confidence}%
                  </span>

                  {/* Status badge */}
                  <Badge
                    variant={STATUS_VARIANT[row.status]}
                    className="text-[10px] sm:text-xs min-w-[80px] sm:min-w-[100px] justify-center"
                  >
                    {row.status === "Scanning..." && (
                      <span className="relative flex h-1.5 w-1.5 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                      </span>
                    )}
                    {row.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
