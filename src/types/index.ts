export interface Contributor {
  id: string;
  full_name: string;
  email: string;
  track_type: "sfw";
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
  face_embedding_anchor: Record<string, number> | null;
  profile_completed: boolean;
  capture_completed: boolean;
  current_onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export interface Upload {
  id: string;
  contributor_id: string;
  source: "instagram" | "manual";
  file_path: string;
  original_url: string | null;
  file_size: number | null;
  bucket: string;
  created_at: string;
}
