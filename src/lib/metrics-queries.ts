import { createServiceClient } from "@/lib/supabase/server";

// --- Interfaces ---

export interface WeeklyDataPoint {
  week: string;
  value: number;
  free?: number;
  paid?: number;
}

export interface WeeklyMatchTakedownPoint {
  week: string;
  matches: number;
  takedowns: number;
}

export interface PlatformCount {
  platform: string;
  count: number;
}

export interface TakedownPlatformStats {
  platform: string;
  total: number;
  resolved: number;
  successRate: number;
  avgResponseDays: number;
}

export interface DemographicGroup {
  label: string;
  count: number;
  total: number;
  percentage: number;
}

export interface TotalStats {
  totalEnrolled: number;
  totalMatches: number;
  totalTakedownsResolved: number;
  totalTakedownsSubmitted: number;
  takedownSuccessRate: number;
}

export interface OverviewMetrics {
  enrollmentsThisWeek: number;
  enrollmentsLastWeek: number;
  enrollmentChange: number;
  takedownSuccessRate: number;
  totalProtected: number;
  totalMatches: number;
}

// --- Helpers ---

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateWeeks(weeks: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    result.push(getWeekStart(d));
  }
  return result;
}

function getCutoffDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d.toISOString();
}

// --- Query Functions ---

export async function getEnrollmentsByWeek(
  weeks = 12
): Promise<WeeklyDataPoint[]> {
  const supabase = await createServiceClient();
  const cutoff = getCutoffDate(weeks);

  const { data } = await supabase
    .from("contributors")
    .select("created_at")
    .gte("created_at", cutoff);

  const weekBuckets = generateWeeks(weeks);
  const counts = new Map<string, number>();
  weekBuckets.forEach((w) => counts.set(w, 0));

  for (const row of data || []) {
    const ws = getWeekStart(
      new Date((row as { created_at: string }).created_at)
    );
    if (counts.has(ws)) {
      counts.set(ws, (counts.get(ws) || 0) + 1);
    }
  }

  return weekBuckets.map((w) => ({
    week: formatWeekLabel(w),
    value: counts.get(w) || 0,
    // TODO: free/paid split requires subscription/billing tables
    free: counts.get(w) || 0,
    paid: 0,
  }));
}

export async function getMatchesAndTakedownsByWeek(
  weeks = 12
): Promise<WeeklyMatchTakedownPoint[]> {
  const supabase = await createServiceClient();
  const cutoff = getCutoffDate(weeks);

  const [{ data: matchData }, { data: takedownData }] = await Promise.all([
    supabase.from("matches").select("created_at").gte("created_at", cutoff),
    supabase.from("takedowns").select("created_at").gte("created_at", cutoff),
  ]);

  const weekBuckets = generateWeeks(weeks);
  const matchCounts = new Map<string, number>();
  const takedownCounts = new Map<string, number>();
  weekBuckets.forEach((w) => {
    matchCounts.set(w, 0);
    takedownCounts.set(w, 0);
  });

  for (const row of matchData || []) {
    const ws = getWeekStart(
      new Date((row as { created_at: string }).created_at)
    );
    if (matchCounts.has(ws)) {
      matchCounts.set(ws, (matchCounts.get(ws) || 0) + 1);
    }
  }

  for (const row of takedownData || []) {
    const ws = getWeekStart(
      new Date((row as { created_at: string }).created_at)
    );
    if (takedownCounts.has(ws)) {
      takedownCounts.set(ws, (takedownCounts.get(ws) || 0) + 1);
    }
  }

  return weekBuckets.map((w) => ({
    week: formatWeekLabel(w),
    matches: matchCounts.get(w) || 0,
    takedowns: takedownCounts.get(w) || 0,
  }));
}

export async function getMatchesByPlatform(): Promise<PlatformCount[]> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("matches")
    .select("discovered_images(platform)")
    .limit(5000);

  const platformCounts = new Map<string, number>();

  for (const row of data || []) {
    const r = row as unknown as {
      discovered_images: { platform: string | null } | null;
    };
    const platform = r.discovered_images?.platform || "Unknown";
    platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
  }

  return Array.from(platformCounts.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getTakedownSuccessByPlatform(): Promise<
  TakedownPlatformStats[]
> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("takedowns")
    .select("platform, status, submitted_at, resolved_at")
    .limit(5000);

  const platformMap = new Map<
    string,
    { total: number; resolved: number; responseDays: number[] }
  >();

  for (const row of data || []) {
    const r = row as {
      platform: string;
      status: string;
      submitted_at: string | null;
      resolved_at: string | null;
    };
    const platform = r.platform || "Unknown";

    if (!platformMap.has(platform)) {
      platformMap.set(platform, { total: 0, resolved: 0, responseDays: [] });
    }

    const stats = platformMap.get(platform)!;
    stats.total++;

    if (r.status === "resolved") {
      stats.resolved++;
      if (r.submitted_at && r.resolved_at) {
        const days =
          (new Date(r.resolved_at).getTime() -
            new Date(r.submitted_at).getTime()) /
          (1000 * 60 * 60 * 24);
        stats.responseDays.push(days);
      }
    }
  }

  return Array.from(platformMap.entries())
    .map(([platform, stats]) => ({
      platform,
      total: stats.total,
      resolved: stats.resolved,
      successRate:
        stats.total > 0
          ? Math.round((stats.resolved / stats.total) * 100)
          : 0,
      avgResponseDays:
        stats.responseDays.length > 0
          ? Math.round(
              (stats.responseDays.reduce((a, b) => a + b, 0) /
                stats.responseDays.length) *
                10
            ) / 10
          : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getTotalStats(): Promise<TotalStats> {
  const supabase = await createServiceClient();

  const [
    { count: totalEnrolled },
    { count: totalMatches },
    { count: totalTakedownsResolved },
    { count: totalTakedownsSubmitted },
  ] = await Promise.all([
    supabase
      .from("contributors")
      .select("*", { count: "exact", head: true }),
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase
      .from("takedowns")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved"),
    supabase
      .from("takedowns")
      .select("*", { count: "exact", head: true })
      .in("status", ["submitted", "resolved"]),
  ]);

  const resolved = totalTakedownsResolved || 0;
  const submitted = totalTakedownsSubmitted || 0;

  return {
    totalEnrolled: totalEnrolled || 0,
    totalMatches: totalMatches || 0,
    totalTakedownsResolved: resolved,
    totalTakedownsSubmitted: submitted,
    takedownSuccessRate:
      submitted > 0 ? Math.round((resolved / submitted) * 100) : 0,
  };
}

export async function getDemographicCoverage(): Promise<{
  ageGroups: DemographicGroup[];
  genderGroups: DemographicGroup[];
}> {
  const supabase = await createServiceClient();

  const { data, count } = await supabase
    .from("contributor_attributes")
    .select("age_range, gender", { count: "exact" });

  const total = count || 0;

  const ageCounts = new Map<string, number>();
  const genderCounts = new Map<string, number>();

  for (const row of data || []) {
    const r = row as { age_range: string | null; gender: string | null };
    if (r.age_range) {
      ageCounts.set(r.age_range, (ageCounts.get(r.age_range) || 0) + 1);
    }
    if (r.gender) {
      genderCounts.set(r.gender, (genderCounts.get(r.gender) || 0) + 1);
    }
  }

  const ageOrder = ["18-24", "25-34", "35-44", "45-54", "55+"];
  const ageGroups: DemographicGroup[] = ageOrder.map((label) => {
    const c = ageCounts.get(label) || 0;
    return {
      label,
      count: c,
      total,
      percentage: total > 0 ? Math.round((c / total) * 100) : 0,
    };
  });

  const genderGroups: DemographicGroup[] = Array.from(
    genderCounts.entries()
  )
    .map(([label, c]) => ({
      label,
      count: c,
      total,
      percentage: total > 0 ? Math.round((c / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { ageGroups, genderGroups };
}

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const supabase = await createServiceClient();

  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const [
    { count: enrollmentsThisWeek },
    { count: enrollmentsLastWeek },
    { count: totalProtected },
    { count: totalMatches },
    { count: resolvedTakedowns },
    { count: allTakedowns },
  ] = await Promise.all([
    supabase
      .from("contributors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thisWeekStart.toISOString()),
    supabase
      .from("contributors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", lastWeekStart.toISOString())
      .lt("created_at", thisWeekStart.toISOString()),
    supabase
      .from("contributors")
      .select("*", { count: "exact", head: true }),
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase
      .from("takedowns")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved"),
    supabase
      .from("takedowns")
      .select("*", { count: "exact", head: true })
      .in("status", ["submitted", "resolved"]),
  ]);

  const thisWeek = enrollmentsThisWeek || 0;
  const lastWeek = enrollmentsLastWeek || 0;
  const change =
    lastWeek > 0
      ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
      : thisWeek > 0
        ? 100
        : 0;

  const resolved = resolvedTakedowns || 0;
  const total = allTakedowns || 0;

  return {
    enrollmentsThisWeek: thisWeek,
    enrollmentsLastWeek: lastWeek,
    enrollmentChange: change,
    takedownSuccessRate:
      total > 0 ? Math.round((resolved / total) * 100) : 0,
    totalProtected: totalProtected || 0,
    totalMatches: totalMatches || 0,
  };
}
