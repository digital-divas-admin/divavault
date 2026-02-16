import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  DashboardContributor,
  DashboardUpload,
  ActivityLog,
  NotificationPreferences,
} from "@/types/dashboard";

export async function getContributor(
  userId: string
): Promise<DashboardContributor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contributors")
    .select("*")
    .eq("id", userId)
    .single();
  return data as DashboardContributor | null;
}

export async function getUploadsWithSignedUrls(
  userId: string,
  statusFilter?: string
): Promise<DashboardUpload[]> {
  const supabase = await createClient();
  let query = supabase
    .from("uploads")
    .select("*")
    .eq("contributor_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: uploads } = await query;
  if (!uploads || uploads.length === 0) return [];

  const results = await Promise.allSettled(
    (uploads as DashboardUpload[]).map(async (upload) => {
      if (upload.source === "instagram" && upload.original_url) {
        return { ...upload, signed_url: upload.original_url };
      }
      const { data } = await supabase.storage
        .from(upload.bucket)
        .createSignedUrl(upload.file_path, 3600);
      return { ...upload, signed_url: data?.signedUrl || undefined };
    })
  );

  return results.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : { ...(uploads as DashboardUpload[])[i], signed_url: undefined }
  );
}

export async function getActivityLog(
  userId: string,
  limit = 20
): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .eq("contributor_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as ActivityLog[]) || [];
}

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("contributor_id", userId)
    .single();

  if (data) return data as NotificationPreferences;

  // Return defaults if no row exists
  return {
    contributor_id: userId,
    email_earnings: true,
    email_photo_status: true,
    email_platform_updates: true,
    email_security_alerts: true,
    email_match_alerts: true,
    email_scan_updates: true,
    email_takedown_updates: true,
    email_bounty_matches: true,
    email_bounty_updates: true,
    email_optout_updates: true,
    updated_at: new Date().toISOString(),
  };
}

export async function logActivity(
  userId: string,
  action: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createServiceClient();
  await supabase.from("activity_log").insert({
    contributor_id: userId,
    action,
    description,
    metadata: metadata || null,
  });
}
