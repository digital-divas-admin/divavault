// Capture session types
export type CaptureSessionStatus = "active" | "paused" | "completed" | "abandoned";
export type CaptureSessionType = "onboarding" | "supplemental";

export interface CaptureSession {
  id: string;
  contributor_id: string;
  session_type: CaptureSessionType;
  status: CaptureSessionStatus;
  device_info: DeviceInfo | null;
  images_captured: number;
  images_required: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  cameraFacing: "user" | "environment";
}

// Contributor image types
export type CaptureStep =
  | "face_front"
  | "face_left"
  | "face_right"
  | "face_up"
  | "face_down"
  | "expression_smile"
  | "expression_neutral"
  | "expression_serious"
  | "upper_body"
  | "full_body";

export interface ContributorImage {
  id: string;
  contributor_id: string;
  session_id: string;
  capture_step: CaptureStep;
  pose: string | null;
  angle: string | null;
  expression: string | null;
  file_path: string;
  bucket: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  quality_score: number | null;
  sharpness_score: number | null;
  brightness_score: number | null;
  identity_match_score: number | null;
  created_at: string;
}

// Granular consent types
export type UsageCategory = "commercial" | "editorial" | "entertainment" | "e_learning";
export type GeoRestriction = "US" | "EU" | "UK" | "APAC" | "LATAM" | "MENA" | "global";
export type ContentExclusion = "political" | "religious" | "tobacco" | "alcohol" | "gambling" | "weapons" | "adult_adjacent";

export interface ContributorConsent {
  id: string;
  contributor_id: string;
  consent_version: string;
  // Core consents (existing)
  consent_age: boolean;
  consent_ai_training: boolean;
  consent_likeness: boolean;
  consent_revocation: boolean;
  consent_privacy: boolean;
  // Granular usage categories
  allow_commercial: boolean;
  allow_editorial: boolean;
  allow_entertainment: boolean;
  allow_e_learning: boolean;
  // Restrictions
  geo_restrictions: GeoRestriction[];
  content_exclusions: ContentExclusion[];
  // Audit
  consent_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
  created_at: string;
}

// Capture step configuration
export interface CaptureStepConfig {
  id: CaptureStep;
  label: string;
  instruction: string;
  poseGuide: "face_oval" | "upper_body" | "full_body";
  requiredChecks: QualityCheckType[];
}

// Quality check types
export type QualityCheckType = "face_detected" | "sharpness" | "brightness" | "face_centered" | "face_size";

export interface QualityCheckResult {
  type: QualityCheckType;
  passed: boolean;
  value: number;
  threshold: number;
  message: string;
}

// Upload queue types
export interface QueuedUpload {
  id: string;
  sessionId: string;
  step: CaptureStep;
  blob: Blob;
  fileName: string;
  retryCount: number;
  maxRetries: number;
  status: "pending" | "uploading" | "completed" | "failed";
  createdAt: number;
}
