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
  title: string;
  description: string;
  timestamp: string;
}

export async function getRecentAdminActivity(
  limit = 10
): Promise<AdminActivityItem[]> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("contributors")
    .select("full_name, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((s) => {
    const row = s as { display_name: string | null; full_name: string; created_at: string };
    return {
      title: "New signup",
      description: row.display_name || row.full_name,
      timestamp: row.created_at,
    };
  });
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

  return { contributors: data as ContributorListItem[], total: count || 0 };
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

  const row = data as ContributorDetail & { suspended?: boolean; flagged?: boolean };
  return {
    ...row,
    suspended: row.suspended || false,
    flagged: row.flagged || false,
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
