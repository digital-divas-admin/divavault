import type { SubscriptionTier, TierCapabilities } from "@/types/protection";

const capabilities: Record<SubscriptionTier, TierCapabilities> = {
  free: {
    tier: "free",
    canSeeFullDetails: false,
    canSeeEvidence: false,
    canRequestTakedown: false,
    hasAiDetection: false,
    canSeePlatformUrls: false,
    scanFrequency: "Weekly",
    platformLimit: 2,
    knownAccountsLimit: 3,
    hasLegalConsultation: false,
    hasMultiPerson: false,
    hasApiAccess: false,
    displayName: "Free",
    price: "$0",
    upgradeTarget: "protected",
    upgradeHeading: "Unlock Full Protection",
    upgradeDescription: "You're on the Free plan. Upgrade to get:",
    upgradeCtaLabel: "Upgrade to Protected — $9.99/mo",
    upgradeFeatures: [
      { label: "Daily scans", current: "Currently weekly" },
      { label: "All platforms monitored", current: "Currently 2" },
      { label: "Automated DMCA takedowns" },
      { label: "Full match details & evidence" },
    ],
  },
  protected: {
    tier: "protected",
    canSeeFullDetails: true,
    canSeeEvidence: true,
    canRequestTakedown: true,
    hasAiDetection: true,
    canSeePlatformUrls: true,
    scanFrequency: "Daily",
    platformLimit: null,
    knownAccountsLimit: 10,
    hasLegalConsultation: false,
    hasMultiPerson: false,
    hasApiAccess: false,
    displayName: "Protected",
    price: "$9.99/mo",
    upgradeTarget: "premium",
    upgradeHeading: "Go Premium",
    upgradeDescription: "Upgrade for maximum protection:",
    upgradeCtaLabel: "Upgrade to Premium — $24.99/mo",
    upgradeFeatures: [
      { label: "Scans every 6 hours", current: "Currently daily" },
      { label: "Legal consultation access" },
      { label: "Multi-person protection" },
    ],
  },
  premium: {
    tier: "premium",
    canSeeFullDetails: true,
    canSeeEvidence: true,
    canRequestTakedown: true,
    hasAiDetection: true,
    canSeePlatformUrls: true,
    scanFrequency: "Every 6h",
    platformLimit: null,
    knownAccountsLimit: 25,
    hasLegalConsultation: true,
    hasMultiPerson: true,
    hasApiAccess: true,
    displayName: "Premium",
    price: "$24.99/mo",
    upgradeTarget: null,
    upgradeHeading: "",
    upgradeDescription: "",
    upgradeCtaLabel: "",
    upgradeFeatures: [],
  },
};

export function getTierCapabilities(
  tier: string | null | undefined
): TierCapabilities {
  const resolved = (tier || "free") as SubscriptionTier;
  return capabilities[resolved] || capabilities.free;
}
