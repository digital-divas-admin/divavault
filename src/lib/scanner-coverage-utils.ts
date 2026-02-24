/**
 * Pure utility functions for scanner coverage metrics.
 * Separated from scanner-command-queries.ts to avoid pulling
 * server-only imports (createServiceClient) into client components.
 */

export interface DailySnapshot {
  id: string;
  snapshot_date: string;
  platform: string;
  images_discovered: number;
  images_with_faces: number;
  embeddings_created: number;
  matches_found: number;
  matches_confirmed: number;
  matches_rejected: number;
  tags_total: number;
  tags_exhausted: number;
}

export interface SearchTermProgress {
  term: string;
  exhausted: boolean;
  cursor: string | null;
  pages: number | null;
}

export type CoverageHealthState = "active" | "stabilizing" | "saturated";

export interface CoverageHealth {
  state: CoverageHealthState;
  newImageRate: number;
  tagExhaustionPct: number;
}

/**
 * Parse search term progress from platform_crawl_schedule.search_terms JSONB.
 * Extracts per-term cursor state to show exhaustion status.
 */
export function parseSearchTermProgress(
  searchTerms: Record<string, unknown> | null
): SearchTermProgress[] {
  if (!searchTerms) return [];
  const results: SearchTermProgress[] = [];
  const searchCursors = (searchTerms.search_cursors ?? {}) as Record<string, string | null>;
  const modelCursors = (searchTerms.model_cursors ?? {}) as Record<string, string | null>;
  const terms = (searchTerms.terms ?? []) as string[];

  // Merge search cursors and model cursors
  const allTerms = new Set([...terms, ...Object.keys(searchCursors), ...Object.keys(modelCursors)]);

  for (const term of allTerms) {
    const searchCursor = searchCursors[term];
    const modelCursor = modelCursors[term];
    // A term is exhausted if its cursor is null (no more pages)
    const exhausted = searchCursor === undefined
      ? modelCursor === undefined || modelCursor === null
      : searchCursor === null;
    results.push({
      term,
      exhausted,
      cursor: searchCursor ?? modelCursor ?? null,
      pages: null, // Not tracked per-term
    });
  }

  return results.sort((a, b) => {
    if (a.exhausted !== b.exhausted) return a.exhausted ? 1 : -1;
    return a.term.localeCompare(b.term);
  });
}

/**
 * Compute coverage health from daily snapshots for a given platform.
 * Uses velocity decay: compares today's new images vs 7-day rolling average.
 */
export function computeCoverageHealth(
  snapshots: DailySnapshot[],
  platform: string
): CoverageHealth {
  const platformSnapshots = snapshots
    .filter((s) => s.platform === platform)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  const latestSnapshot = platformSnapshots[platformSnapshots.length - 1];
  const tagExhaustionPct = latestSnapshot
    ? latestSnapshot.tags_total > 0
      ? (latestSnapshot.tags_exhausted / latestSnapshot.tags_total) * 100
      : 0
    : 0;

  if (platformSnapshots.length < 2) {
    return { state: "active", newImageRate: 100, tagExhaustionPct };
  }

  // Compute day-over-day new images (delta of images_discovered)
  const deltas: number[] = [];
  for (let i = 1; i < platformSnapshots.length; i++) {
    const delta = platformSnapshots[i].images_discovered - platformSnapshots[i - 1].images_discovered;
    deltas.push(Math.max(0, delta));
  }

  // Rolling 7-day average
  const recentDeltas = deltas.slice(-7);
  const rollingAvg = recentDeltas.length > 0
    ? recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length
    : 0;

  // Latest day's new images
  const latestDelta = deltas.length > 0 ? deltas[deltas.length - 1] : 0;

  // New image rate: latest as % of rolling average
  const newImageRate = rollingAvg > 0 ? (latestDelta / rollingAvg) * 100 : 0;

  let state: CoverageHealthState;
  if (rollingAvg === 0 || newImageRate < 5) {
    state = "saturated";
  } else if (newImageRate < 50) {
    state = "stabilizing";
  } else {
    state = "active";
  }

  return { state, newImageRate, tagExhaustionPct };
}
