// Registry Identity types

/** CID format: CID-1 followed by 16 lowercase hex characters */
export type CID = `CID-1${string}`;

export type RegistryIdentityStatus = "claimed" | "verified" | "suspended" | "revoked";

export type ConsentEventType = "grant" | "modify" | "restrict" | "revoke" | "reinstate";

export type ConsentSource = "onboarding" | "dashboard" | "api" | "admin" | "system";

export type VerificationMethod = "veriff_full" | "selfie_liveness";

export type VerificationResult = "passed" | "failed" | "inconclusive" | "expired";

export type ConfidenceTier = "low" | "medium" | "high";

export type MatchStatus = "pending" | "confirmed" | "dismissed" | "actioned";

/** Structured consent scope matching Consent Spec v0.1 */
export interface ConsentScope {
  spec_version?: string;
  use_types?: Record<string, boolean>;
  geographic_scope?: { type: "allowlist" | "blocklist"; regions: string[] };
  content_exclusions?: string[];
  modalities?: Record<string, boolean>;
  temporal?: { valid_from: string; valid_until: string | null; auto_renew: boolean };
  /** Set when event_type is 'revoke' */
  revocation_reason?: string;
}

export interface RegistryIdentity {
  cid: string;
  status: RegistryIdentityStatus;
  face_embedding: number[] | null;
  embedding_model: string;
  identity_hash: string;
  display_name_hash: string | null;
  created_at: string;
  verified_at: string | null;
  suspended_at: string | null;
  metadata: Record<string, unknown>;
}

export interface RegistryConsentEvent {
  event_id: string;
  cid: string;
  event_type: ConsentEventType;
  consent_scope: ConsentScope;
  jurisdiction: string | null;
  evidence_hash: string;
  previous_event_id: string | null;
  event_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  recorded_at: string;
  spec_version: string;
  source: ConsentSource;
  legacy_consent_id: string | null;
}

export interface RegistryVerification {
  id: string;
  cid: string;
  method: VerificationMethod;
  provider: string | null;
  provider_session_id: string | null;
  result: VerificationResult;
  evidence_hash: string | null;
  confidence_score: number | null;
  recorded_at: string;
  metadata: Record<string, unknown>;
}

export interface RegistryMatch {
  id: string;
  cid: string;
  source_url: string | null;
  page_url: string | null;
  platform: string | null;
  similarity_score: number;
  confidence_tier: ConfidenceTier;
  match_status: MatchStatus;
  is_ai_generated: boolean | null;
  ai_detection_score: number | null;
  evidence_hash: string | null;
  discovered_at: string;
  reviewed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface RegistryContact {
  id: string;
  cid: string;
  contact_type: string;
  contact_value: string;
  verified: boolean;
  notification_prefs: Record<string, boolean>;
  created_at: string;
}

/** Input for creating a new consent event */
export interface ConsentEventInput {
  cid: string;
  eventType: ConsentEventType;
  consentScope: ConsentScope;
  source: ConsentSource;
  ipAddress?: string | null;
  userAgent?: string | null;
  legacyConsentId?: string | null;
}
