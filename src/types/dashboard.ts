export interface ActivityLog {
  id: string;
  contributor_id: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationPreferences {
  contributor_id: string;
  email_earnings: boolean;
  email_photo_status: boolean;
  email_platform_updates: boolean;
  email_security_alerts: boolean;
  email_match_alerts: boolean;
  email_scan_updates: boolean;
  email_takedown_updates: boolean;
  email_optout_updates: boolean;
  email_bounty_matches: boolean;
  email_bounty_updates: boolean;
  updated_at: string;
  [key: string]: string | boolean;
}

export type UploadStatus =
  | "processing"
  | "active"
  | "pending_review"
  | "flagged"
  | "removed";

export interface DashboardUpload {
  id: string;
  contributor_id: string;
  source: "instagram" | "manual" | "capture";
  file_path: string;
  original_url: string | null;
  file_size: number | null;
  bucket: string;
  status: UploadStatus;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  signed_url?: string;
}

export interface DashboardContributor {
  id: string;
  full_name: string;
  email: string;
  verification_status: "pending" | "green" | "red" | "retry";
  veriff_session_id: string | null;
  instagram_username: string | null;
  instagram_token: string | null;
  photo_count: number;
  consent_given: boolean;
  consent_timestamp: string | null;
  consent_version: string | null;
  paypal_email: string | null;
  consent_details: Record<string, boolean> | null;
  onboarding_completed: boolean;
  opted_out: boolean;
  opted_out_at: string | null;
  display_name: string | null;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  last_login_at: string | null;
  suspended: boolean;
  suspended_at: string | null;
  flagged: boolean;
  flag_reason: string | null;
  subscription_tier: string;
  created_at: string;
  updated_at: string;
}
