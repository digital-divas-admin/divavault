import type { FederalBill } from "@/data/legal-landscape/types";

export const federalBills: FederalBill[] = [
  {
    id: "bill-005",
    name: "TAKE IT DOWN Act",
    billNumber: "S.5678",
    status: "signed",
    sponsors: ["Sen. Ted Cruz", "Sen. Amy Klobuchar", "Rep. Maria Salazar"],
    summary:
      "Criminalizes the non-consensual publication of intimate images, including AI-generated deepfakes. Requires platforms to remove flagged content within 48 hours of a valid report.",
    lastAction: "Signed into law by the President",
    lastActionDate: "2025-05-15",
    relevance:
      "Directly protects individuals from AI-generated non-consensual intimate imagery and establishes federal enforcement mechanisms.",
  },
  {
    id: "bill-001",
    name: "NO FAKES Act",
    billNumber: "S.1234",
    status: "committee",
    sponsors: ["Sen. Chris Coons", "Sen. Marsha Blackburn", "Sen. Amy Klobuchar"],
    summary:
      "Establishes a federal right to protect individuals from unauthorized AI-generated replicas of their voice and visual likeness. Creates a private right of action and platform liability framework.",
    lastAction: "Referred to Senate Judiciary Committee for markup",
    lastActionDate: "2025-02-10",
    relevance:
      "Would create the first comprehensive federal protection for voice and visual likeness against AI replication, filling gaps in state-by-state protections.",
  },
  {
    id: "bill-003",
    name: "AI Labeling Act",
    billNumber: "H.R.3456",
    status: "committee",
    sponsors: ["Rep. Yvette Clarke", "Rep. Anna Eshoo"],
    summary:
      "Requires clear labeling and disclosure of AI-generated or AI-modified content, including synthetic images and videos. Applies to platforms and content creators distributing AI media.",
    lastAction: "Hearing held by House Energy and Commerce Subcommittee",
    lastActionDate: "2025-01-22",
    relevance:
      "Mandatory labeling would help individuals identify when their likeness has been used in AI-generated content and support enforcement of other likeness protection laws.",
  },
  {
    id: "bill-002",
    name: "DEFIANCE Act",
    billNumber: "S.2345",
    status: "introduced",
    sponsors: ["Sen. Dick Durbin", "Sen. Lindsey Graham"],
    summary:
      "Criminalizes the creation and distribution of non-consensual deepfake images and videos. Provides civil remedies for victims and establishes penalties for repeat offenders.",
    lastAction: "Introduced and referred to Senate Judiciary Committee",
    lastActionDate: "2024-11-05",
    relevance:
      "Would establish criminal penalties specifically targeting deepfake creators, complementing existing civil protections for likeness rights.",
  },
  {
    id: "bill-004",
    name: "Digital Replica Right Act",
    billNumber: "H.R.4567",
    status: "introduced",
    sponsors: ["Rep. Adam Schiff", "Rep. Maria Salazar", "Rep. Madeleine Dean"],
    summary:
      "Creates a federal right of publicity specifically for digital replicas, granting individuals exclusive control over AI-generated versions of their likeness. Includes post-mortem protections for 70 years.",
    lastAction: "Introduced and referred to House Judiciary Committee",
    lastActionDate: "2024-09-30",
    relevance:
      "Would unify the patchwork of state publicity rights into a single federal standard, providing consistent protections for digital replicas nationwide.",
  },
  {
    id: "bill-006",
    name: "Protect Elections from Deceptive AI Act",
    billNumber: "S.6789",
    status: "expired",
    sponsors: ["Sen. Brian Schatz", "Sen. John Kennedy"],
    summary:
      "Prohibited the use of AI-generated deepfakes in political advertising within 60 days of an election. Required disclosure of AI involvement in political media content.",
    lastAction: "Failed to advance before end of congressional session",
    lastActionDate: "2024-01-03",
    relevance:
      "Though expired, highlighted the growing concern over AI deepfakes in elections and laid the groundwork for future election-related AI legislation.",
  },
];
