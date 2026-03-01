import { createServiceClient } from "@/lib/supabase/server";
import type { AdminUser, AdminRole } from "@/types/marketplace";

export async function getAdminUser(
  userId: string
): Promise<AdminUser | null> {
  // Use service client to bypass RLS — admin_users has a self-referential
  // SELECT policy that would block reads via the session client.
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", userId)
    .single();
  return data as AdminUser | null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const admin = await getAdminUser(userId);
  return admin !== null;
}

export async function getAdminRole(
  userId: string
): Promise<AdminRole | null> {
  const admin = await getAdminUser(userId);
  return admin?.role || null;
}

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  reviewer: 1,
  admin: 2,
  super_admin: 3,
};

/**
 * Require the user to have at minimum the given admin role.
 * Returns the role if authorized, or null if not.
 */
export async function requireAdmin(
  userId: string,
  minRole: AdminRole = "reviewer"
): Promise<AdminRole | null> {
  const role = await getAdminRole(userId);
  if (!role) return null;
  if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) return null;
  return role;
}

// Admin dashboard stats
export interface AdminStats {
  totalUsers: number;
  newSignupsToday: number;
  newSignupsThisWeek: number;
  newSignupsThisMonth: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createServiceClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalUsers },
    { count: newSignupsToday },
    { count: newSignupsThisWeek },
    { count: newSignupsThisMonth },
  ] = await Promise.all([
    supabase.from("contributors").select("*", { count: "exact", head: true }),
    supabase.from("contributors").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("contributors").select("*", { count: "exact", head: true }).gte("created_at", weekStart),
    supabase.from("contributors").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
  ]);

  return {
    totalUsers: totalUsers || 0,
    newSignupsToday: newSignupsToday || 0,
    newSignupsThisWeek: newSignupsThisWeek || 0,
    newSignupsThisMonth: newSignupsThisMonth || 0,
  };
}

// Recent admin activity feed
export interface AdminActivityItem {
  type: "signup";
  title: string;
  description: string;
  timestamp: string;
}

export async function getRecentAdminActivity(
  limit = 10
): Promise<AdminActivityItem[]> {
  const supabase = await createServiceClient();

  const { data: recentSignups } = await supabase
    .from("contributors")
    .select("full_name, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const items: AdminActivityItem[] = [];

  for (const s of recentSignups || []) {
    items.push({
      type: "signup",
      title: "New signup",
      description: (s as { display_name: string | null; full_name: string }).display_name || (s as { full_name: string }).full_name,
      timestamp: (s as { created_at: string }).created_at,
    });
  }

  return items;
}

// User management queries
export interface ContributorListItem {
  id: string;
  full_name: string;
  email: string;
  display_name: string | null;
  verification_status: string;
  photo_count: number;
  onboarding_completed: boolean;
  suspended: boolean;
  flagged: boolean;
  created_at: string;
}

export async function getAllContributors({
  search,
  verificationStatus,
  page = 1,
  pageSize = 20,
}: {
  search?: string;
  verificationStatus?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ contributors: ContributorListItem[]; total: number }> {
  const supabase = await createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contributors")
    .select("id, full_name, email, display_name, verification_status, photo_count, onboarding_completed, suspended, flagged, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }
  if (verificationStatus && verificationStatus !== "all") {
    query = query.eq("verification_status", verificationStatus);
  }

  const { data, count } = await query;

  if (!data) return { contributors: [], total: 0 };

  const contributors: ContributorListItem[] = data.map((c) => {
    const row = c as {
      id: string;
      full_name: string;
      email: string;
      display_name: string | null;
      verification_status: string;
      photo_count: number;
      onboarding_completed: boolean;
      suspended: boolean;
      flagged: boolean;
      created_at: string;
    };
    return { ...row };
  });

  return { contributors, total: count || 0 };
}

export interface ContributorDetail {
  id: string;
  full_name: string;
  email: string;
  display_name: string | null;
  verification_status: string;
  instagram_username: string | null;
  photo_count: number;
  consent_given: boolean;
  consent_timestamp: string | null;
  onboarding_completed: boolean;
  opted_out: boolean;
  opted_out_at: string | null;
  last_login_at: string | null;
  suspended: boolean;
  suspended_at: string | null;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function getContributorAdmin(
  userId: string
): Promise<ContributorDetail | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("contributors")
    .select("*")
    .eq("id", userId)
    .single();

  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    full_name: row.full_name as string,
    email: row.email as string,
    display_name: row.display_name as string | null,
    verification_status: row.verification_status as string,
    instagram_username: row.instagram_username as string | null,
    photo_count: row.photo_count as number,
    consent_given: row.consent_given as boolean,
    consent_timestamp: row.consent_timestamp as string | null,
    onboarding_completed: row.onboarding_completed as boolean,
    opted_out: row.opted_out as boolean,
    opted_out_at: row.opted_out_at as string | null,
    last_login_at: row.last_login_at as string | null,
    suspended: (row.suspended as boolean) || false,
    suspended_at: row.suspended_at as string | null,
    flagged: (row.flagged as boolean) || false,
    flag_reason: row.flag_reason as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function suspendContributor(
  userId: string,
  suspend: boolean
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("contributors")
    .update({
      suspended: suspend,
      suspended_at: suspend ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function flagContributor(
  userId: string,
  flagged: boolean,
  reason?: string
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("contributors")
    .update({
      flagged,
      flag_reason: flagged ? (reason || null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}
