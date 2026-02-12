export interface ProtectionStats {
  matchCount: number;
  newMatchCount: number;
  imagesScanned: number;
  platformsMonitored: number;
  takedownsFiled: number;
  takedownsResolved: number;
  lastScanAt: string | null;
  nextScanAt: string | null;
}

export interface ContributorMatch {
  id: string;
  discovered_image_id: string;
  contributor_id: string;
  similarity_score: number;
  confidence_tier: string;
  is_ai_generated: boolean | null;
  ai_detection_score: number | null;
  ai_generator: string | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  // Joined from discovered_images
  platform: string | null;
  source_url: string | null;
  page_url: string | null;
  page_title: string | null;
}

export interface ContributorMatchDetail extends ContributorMatch {
  evidence: MatchEvidence[];
  takedowns: MatchTakedown[];
}

export interface MatchEvidence {
  id: string;
  evidence_type: string;
  storage_url: string;
  sha256_hash: string;
  captured_at: string;
}

export interface MatchTakedown {
  id: string;
  platform: string;
  takedown_type: string;
  status: string;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ProtectionActivity {
  id: string;
  type: "scan" | "match" | "takedown" | "notification";
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MatchesPageStats {
  totalMatches: number;
  newMatches: number;
  activeTakedowns: number;
  resolvedTakedowns: number;
  successRate: number;
  highConfidenceCount: number;
  platformBreakdown: { platform: string; count: number }[];
}

export type MatchDismissReason =
  | "my_account"
  | "not_me"
  | "authorized_use"
  | "other";

export type SubscriptionTier = "free" | "protected" | "premium";

export interface TierUpgradeFeature {
  label: string;
  current?: string;
}

export interface TierCapabilities {
  tier: SubscriptionTier;
  canSeeFullDetails: boolean;
  canSeeEvidence: boolean;
  canRequestTakedown: boolean;
  hasAiDetection: boolean;
  canSeePlatformUrls: boolean;
  scanFrequency: string;
  platformLimit: number | null;
  knownAccountsLimit: number;
  hasLegalConsultation: boolean;
  hasMultiPerson: boolean;
  hasApiAccess: boolean;
  displayName: string;
  price: string;
  upgradeTarget: SubscriptionTier | null;
  upgradeHeading: string;
  upgradeDescription: string;
  upgradeCtaLabel: string;
  upgradeFeatures: TierUpgradeFeature[];
}
