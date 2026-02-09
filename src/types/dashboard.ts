export interface ActivityLog {
  id: string;
  contributor_id: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Earning {
  id: string;
  contributor_id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "processing" | "paid" | "held";
  description: string | null;
  paid_at: string | null;
  payout_batch_id: string | null;
  payout_item_id: string | null;
  payout_failure_reason: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  contributor_id: string;
  email_earnings: boolean;
  email_photo_status: boolean;
  email_platform_updates: boolean;
  email_security_alerts: boolean;
  updated_at: string;
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
  source: "instagram" | "manual";
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
  sumsub_status: "pending" | "green" | "red" | "retry";
  sumsub_applicant_id: string | null;
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
  created_at: string;
  updated_at: string;
}
