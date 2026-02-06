// Admin user roles
export type AdminRole = "reviewer" | "admin" | "super_admin";

export interface AdminUser {
  id: string;
  role: AdminRole;
  display_name: string;
  created_at: string;
  created_by: string | null;
}

// Bounty request types
export type RequestStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "paused"
  | "fulfilled"
  | "closed"
  | "cancelled";

export type RequestCategory =
  | "portrait"
  | "full_body"
  | "lifestyle"
  | "fashion"
  | "fitness"
  | "artistic"
  | "professional"
  | "casual"
  | "themed"
  | "other";

export type TrackType = "sfw" | "nsfw" | "both";
export type PayType = "per_image" | "per_set";
export type Visibility = "open" | "targeted" | "invite_only";

export interface BountyRequest {
  id: string;
  created_by: string;
  title: string;
  description: string;
  model_context: string | null;
  status: RequestStatus;
  scenario_tags: string[];
  setting_tags: string[];
  category: RequestCategory;
  track_type: TrackType;
  target_hair_colors: string[] | null;
  target_eye_colors: string[] | null;
  target_skin_tones: string[] | null;
  target_body_types: string[] | null;
  target_age_range_min: number | null;
  target_age_range_max: number | null;
  target_genders: string[] | null;
  target_ethnicities: string[] | null;
  pay_type: PayType;
  pay_amount_cents: number;
  set_size: number | null;
  speed_bonus_cents: number;
  speed_bonus_deadline: string | null;
  quality_bonus_cents: number;
  budget_total_cents: number;
  budget_spent_cents: number;
  quantity_needed: number;
  quantity_fulfilled: number;
  min_resolution_width: number;
  min_resolution_height: number;
  accepted_formats: string[];
  max_file_size_bytes: number;
  quality_guidelines: string | null;
  estimated_effort: string | null;
  visibility: Visibility;
  deadline: string | null;
  published_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Enriched request with bookmark status for browse view
export interface BountyRequestWithMeta extends BountyRequest {
  is_bookmarked?: boolean;
  existing_submission_id?: string | null;
  existing_submission_status?: SubmissionStatus | null;
}

// Submission types
export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "accepted"
  | "revision_requested"
  | "rejected"
  | "withdrawn";

export interface BountySubmission {
  id: string;
  request_id: string;
  contributor_id: string;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_feedback: string | null;
  revision_count: number;
  earned_amount_cents: number;
  bonus_amount_cents: number;
  earning_id: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

// Enriched submission with request info
export interface SubmissionWithRequest extends BountySubmission {
  bounty_requests: Pick<
    BountyRequest,
    "title" | "category" | "track_type" | "pay_type" | "pay_amount_cents" | "deadline"
  >;
}

// Submission image types
export type ImageStatus = "pending" | "accepted" | "rejected";

export interface SubmissionImage {
  id: string;
  submission_id: string;
  contributor_id: string;
  file_path: string;
  bucket: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  status: ImageStatus;
  rejection_reason: string | null;
  created_at: string;
  signed_url?: string;
}

// Bookmark
export interface BountyBookmark {
  contributor_id: string;
  request_id: string;
  created_at: string;
}

// Contributor attributes (Phase 3)
export interface ContributorAttributes {
  contributor_id: string;
  hair_color: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  body_type: string | null;
  age_range: string | null;
  gender: string | null;
  ethnicity: string | null;
  self_description: string | null;
  share_hair_color: boolean;
  share_eye_color: boolean;
  share_skin_tone: boolean;
  share_body_type: boolean;
  share_age_range: boolean;
  share_gender: boolean;
  share_ethnicity: boolean;
  blocked_categories: string[];
  updated_at: string;
}

// Invitation (Phase 3)
export type InvitationStatus = "pending" | "viewed" | "accepted" | "declined";

export interface BountyInvitation {
  id: string;
  request_id: string;
  contributor_id: string;
  invited_by: string;
  status: InvitationStatus;
  created_at: string;
}

// Report (Phase 3)
export type ReportReason =
  | "uncomfortable"
  | "discriminatory"
  | "inappropriate"
  | "misleading"
  | "other";

export type ReportStatus = "pending" | "reviewed" | "actioned" | "dismissed";

export interface BountyReport {
  id: string;
  request_id: string;
  reporter_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// Filter/sort types for browse
export type RequestSortBy = "newest" | "deadline" | "highest_pay";

export interface RequestFilters {
  search: string;
  category: RequestCategory | "all";
  trackType: TrackType | "all";
  sortBy: RequestSortBy;
}

// Marketplace stats
export interface MarketplaceStats {
  openRequests: number;
  activeSubmissions: number;
  totalEarned: number;
}
