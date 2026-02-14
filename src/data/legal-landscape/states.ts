import type { ActionPath, StateData } from "@/data/legal-landscape/types";

// ---------------------------------------------------------------------------
// Shared action paths — adjusted per protection level
// ---------------------------------------------------------------------------

function getActionPaths(level: StateData["protectionLevel"]): ActionPath[] {
  const levelContext = {
    strong: {
      foundSteps: [
        "Document the unauthorized AI content with screenshots, URLs, and timestamps.",
        "File a complaint under your state's likeness protection laws.",
        "Use Made of Us to file an automated DMCA takedown and track resolution.",
        "Consult a local attorney specializing in right of publicity claims for additional remedies.",
      ],
      protectSteps: [
        "Sign up for Made of Us to create your verified facial signature.",
        "Enable continuous scanning across 247+ AI platforms.",
        "Leverage your state's strong legal protections to support any future claims.",
        "Set up instant alerts so you know the moment your likeness appears.",
      ],
      businessSteps: [
        "Ensure full compliance with your state's likeness and AI consent laws.",
        "Obtain documented consent before using any individual's likeness in AI-generated content.",
        "Implement opt-out mechanisms and maintain audit-ready consent records.",
        "Sign up to learn how Made of Us can help verify and manage consent at scale.",
      ],
    },
    moderate: {
      foundSteps: [
        "Document the unauthorized AI content with screenshots, URLs, and timestamps.",
        "Review your state's existing publicity or privacy statutes for applicable protections.",
        "Use Made of Us to file an automated DMCA takedown while your legal options are assessed.",
        "Consider consulting an attorney, as your state has some protections that may apply.",
      ],
      protectSteps: [
        "Sign up for Made of Us to create your verified facial signature.",
        "Enable continuous scanning to catch unauthorized use early.",
        "Stay informed about pending legislation in your state that could strengthen your rights.",
        "Set up instant alerts for proactive monitoring.",
      ],
      businessSteps: [
        "Review your state's current likeness and privacy laws for compliance requirements.",
        "Obtain documented consent before using any individual's likeness in AI content.",
        "Monitor evolving state regulations and prepare for stricter requirements.",
        "Sign up to learn how Made of Us can help manage consent and compliance.",
      ],
    },
    basic: {
      foundSteps: [
        "Document the unauthorized AI content with screenshots, URLs, and timestamps.",
        "Your state has limited statutory protections — common law claims may still be available.",
        "Use Made of Us to file an automated DMCA takedown as a faster alternative to litigation.",
        "Consult an attorney to explore common law right of publicity or privacy claims.",
      ],
      protectSteps: [
        "Sign up for Made of Us to create your verified facial signature.",
        "Enable continuous scanning — early detection is especially important with limited state protections.",
        "Made of Us provides platform-level protections regardless of your state's laws.",
        "Set up instant alerts to act quickly when unauthorized use is detected.",
      ],
      businessSteps: [
        "Even with limited state laws, federal and platform-level rules may apply to AI-generated likenesses.",
        "Obtain documented consent as a best practice and risk mitigation measure.",
        "Anticipate stronger regulations — many states are considering new AI likeness legislation.",
        "Sign up to learn how Made of Us can help you manage consent proactively.",
      ],
    },
    none: {
      foundSteps: [
        "Document the unauthorized AI content with screenshots, URLs, and timestamps.",
        "Your state currently has no meaningful likeness protection laws on the books.",
        "Use Made of Us to file an automated DMCA takedown — this works regardless of state law.",
        "Federal protections and platform policies may still provide avenues for removal.",
      ],
      protectSteps: [
        "Sign up for Made of Us to create your verified facial signature.",
        "Platform-level and DMCA protections work in every state, even without state laws.",
        "Enable continuous scanning to catch unauthorized use as early as possible.",
        "Stay informed — federal legislation is advancing that would provide nationwide protections.",
      ],
      businessSteps: [
        "Even without state laws, federal regulations and platform terms of service apply.",
        "Obtain documented consent as a best practice to reduce legal and reputational risk.",
        "Federal legislation is likely to create new requirements — prepare now.",
        "Sign up to learn how Made of Us can help future-proof your compliance.",
      ],
    },
  };

  const ctx = levelContext[level];

  return [
    {
      title: "I found unauthorized AI content of me",
      steps: ctx.foundSteps,
      ctaLabel: "Get Protected",
      ctaHref: "/signup",
    },
    {
      title: "I want to protect myself proactively",
      steps: ctx.protectSteps,
      ctaLabel: "Start Free",
      ctaHref: "/signup",
    },
    {
      title: "I'm a business using AI-generated faces",
      steps: ctx.businessSteps,
      ctaLabel: "Learn More",
      ctaHref: "/signup",
      external: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// State data — 50 states + DC, sorted alphabetically by name
// ---------------------------------------------------------------------------

export const statesData: StateData[] = [
  // Alabama — none
  {
    name: "Alabama",
    abbreviation: "AL",
    fips: "01",
    protectionLevel: "none",
    riskScore: 10,
    summary:
      "Alabama has no statute addressing right of publicity or AI-generated likeness. Limited common law precedent exists, leaving residents with few remedies against unauthorized digital replicas.",
    laws: [],
    gaps: [
      { area: "No right of publicity statute", description: "Alabama has never enacted a statutory right of publicity." },
      { area: "No AI-specific provisions", description: "No legislation addresses AI-generated likenesses or deepfakes." },
      { area: "No biometric protections", description: "No laws regulate the collection or use of biometric data." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["No statutory right of publicity", "No AI-specific protections"],
  },

  // Alaska — none
  {
    name: "Alaska",
    abbreviation: "AK",
    fips: "02",
    protectionLevel: "none",
    riskScore: 8,
    summary:
      "Alaska lacks any statutory right of publicity and has minimal common law precedent for likeness claims. There are no pending bills addressing AI-generated content or digital replicas.",
    laws: [],
    gaps: [
      { area: "No right of publicity statute", description: "Alaska provides no statutory protection for personal likeness." },
      { area: "No deepfake protections", description: "No legislation addresses synthetic media or AI-generated content." },
      { area: "No post-mortem protections", description: "No protections extend beyond the lifetime of the individual." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["No likeness protections of any kind", "No pending AI legislation"],
  },

  // Arizona — basic
  {
    name: "Arizona",
    abbreviation: "AZ",
    fips: "04",
    protectionLevel: "basic",
    riskScore: 30,
    summary:
      "Arizona recognizes a common law right of publicity and has a limited statutory provision under its privacy tort framework. However, these laws do not specifically address AI-generated content or digital replicas.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1985,
        description: "Arizona courts recognize a common law right of publicity protecting against unauthorized commercial use of likeness.",
        scope: "Commercial misappropriation only",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "Existing law does not address AI-generated likenesses." },
      { area: "No deepfake protections", description: "No legislation targets synthetic media or deepfakes." },
      { area: "Limited statutory framework", description: "Protections rely on common law precedent rather than statute." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law publicity rights recognized", "No AI-specific legislation"],
  },

  // Arkansas — basic
  {
    name: "Arkansas",
    abbreviation: "AR",
    fips: "05",
    protectionLevel: "basic",
    riskScore: 28,
    summary:
      "Arkansas has a limited right of publicity statute that protects against unauthorized commercial use of a person's name or likeness. The law does not extend to AI-generated content or provide post-mortem protections.",
    laws: [
      {
        name: "Right of Publicity Statute",
        year: 2009,
        description: "Prohibits unauthorized commercial use of a person's name, voice, or likeness.",
        scope: "Commercial use only; limited to living individuals",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute predates modern AI and does not cover digital replicas." },
      { area: "No post-mortem protections", description: "Protections expire at death." },
      { area: "No deepfake protections", description: "No provisions address synthetic or AI-generated media." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Statutory right of publicity since 2009", "No AI or deepfake coverage"],
  },

  // California — strong
  {
    name: "California",
    abbreviation: "CA",
    fips: "06",
    protectionLevel: "strong",
    riskScore: 92,
    summary:
      "California has the most comprehensive AI likeness protections in the nation. AB 2602 and AB 1836 (2024) specifically address digital replicas, and the longstanding Civil Code Section 3344 provides a robust right of publicity with post-mortem protections up to 70 years.",
    laws: [
      {
        name: "AB 2602 — Digital Replica Consent",
        year: 2024,
        description: "Requires explicit consent for creating digital replicas of performers. Makes broad contractual waivers of likeness rights unenforceable without specific terms.",
        scope: "Performers, voice artists, and digital likeness in entertainment",
      },
      {
        name: "AB 1836 — Post-Mortem Digital Replicas",
        year: 2024,
        description: "Extends digital replica protections to deceased individuals, prohibiting unauthorized AI-generated content using a deceased person's likeness.",
        scope: "Post-mortem protections for digital replicas",
      },
      {
        name: "Civil Code Section 3344 — Right of Publicity",
        year: 1971,
        description: "Protects individuals from unauthorized commercial use of their name, voice, signature, photograph, or likeness. Provides statutory damages and attorney's fees.",
        scope: "Commercial use of name, voice, and likeness; post-mortem protections for 70 years",
      },
    ],
    gaps: [
      { area: "AI training data", description: "Laws do not yet directly regulate the use of likenesses in AI training datasets." },
    ],
    actionPaths: getActionPaths("strong"),
    highlights: [
      "Most comprehensive AI likeness laws in the U.S.",
      "AB 2602 requires consent for digital replicas",
      "70-year post-mortem protections",
    ],
  },

  // Colorado — basic
  {
    name: "Colorado",
    abbreviation: "CO",
    fips: "08",
    protectionLevel: "basic",
    riskScore: 35,
    summary:
      "Colorado recognizes a common law right of publicity and has enacted AI-focused legislation around transparency and discrimination, but has no specific statute protecting individuals from unauthorized AI-generated likenesses.",
    laws: [
      {
        name: "Colorado AI Act",
        year: 2024,
        description: "Requires transparency and impact assessments for high-risk AI systems, but does not specifically address likeness rights or digital replicas.",
        scope: "AI system transparency and algorithmic discrimination",
      },
    ],
    gaps: [
      { area: "No likeness-specific AI provisions", description: "The AI Act does not cover unauthorized use of likenesses." },
      { area: "No right of publicity statute", description: "Relies on common law protections only." },
      { area: "No deepfake protections", description: "No legislation addresses AI-generated deepfakes." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Colorado AI Act focuses on algorithmic fairness", "No likeness-specific protections"],
  },

  // Connecticut — basic
  {
    name: "Connecticut",
    abbreviation: "CT",
    fips: "09",
    protectionLevel: "basic",
    riskScore: 32,
    summary:
      "Connecticut has a statutory right to privacy that courts have applied to likeness claims, but it lacks a dedicated right of publicity statute. No legislation specifically addresses AI-generated content or digital replicas.",
    laws: [
      {
        name: "Common Law Right of Privacy",
        year: 1975,
        description: "Courts recognize privacy-based claims for unauthorized use of likeness under the appropriation tort.",
        scope: "Privacy-based claims; commercial misappropriation",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "Connecticut has no dedicated statutory right of publicity." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas or AI-generated content." },
      { area: "No post-mortem protections", description: "Privacy rights are personal and do not survive death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Privacy tort applied to likeness claims", "No AI-specific legislation"],
  },

  // Delaware — basic
  {
    name: "Delaware",
    abbreviation: "DE",
    fips: "10",
    protectionLevel: "basic",
    riskScore: 30,
    summary:
      "Delaware recognizes common law rights of publicity and privacy but has no specific statute addressing likeness protections. AI-generated content and deepfakes are not covered by existing law.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1980,
        description: "Delaware courts recognize common law claims for unauthorized commercial use of a person's likeness.",
        scope: "Commercial misappropriation",
      },
    ],
    gaps: [
      { area: "No statutory protections", description: "Delaware relies entirely on common law for likeness claims." },
      { area: "No AI-specific provisions", description: "No legislation addresses AI-generated content." },
      { area: "No deepfake protections", description: "No laws target synthetic media." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law protections only", "No AI or deepfake legislation"],
  },

  // District of Columbia — moderate
  {
    name: "District of Columbia",
    abbreviation: "DC",
    fips: "11",
    protectionLevel: "moderate",
    riskScore: 55,
    summary:
      "The District of Columbia recognizes both statutory and common law rights of publicity. While the existing framework provides a reasonable baseline, it does not specifically address AI-generated content or digital replicas.",
    laws: [
      {
        name: "DC Code Section 22-3531 — Right of Publicity",
        year: 2013,
        description: "Provides statutory protection against unauthorized commercial use of an individual's name, likeness, or voice.",
        scope: "Commercial use of identity; statutory damages available",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address AI-generated replicas or synthetic media." },
      { area: "No deepfake protections", description: "No provisions target deepfakes or AI-manipulated content." },
      { area: "Limited post-mortem protections", description: "Post-mortem protections are narrow compared to leading states." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Statutory right of publicity since 2013", "Federal proximity may accelerate AI protections"],
  },

  // Florida — moderate
  {
    name: "Florida",
    abbreviation: "FL",
    fips: "12",
    protectionLevel: "moderate",
    riskScore: 60,
    summary:
      "Florida has a well-established statutory right of publicity under Section 540.08 that protects name, likeness, and persona for commercial purposes. However, the statute has not been updated to address AI-generated content or digital replicas.",
    laws: [
      {
        name: "Florida Statute 540.08 — Right of Publicity",
        year: 1967,
        description: "Prohibits unauthorized use of a person's name or likeness for commercial or advertising purposes. Provides both injunctive relief and damages.",
        scope: "Commercial use of name and likeness; 40-year post-mortem protections",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address digital replicas or AI-generated content." },
      { area: "No deepfake protections", description: "No provisions specifically target synthetic media or deepfakes." },
      { area: "Narrow scope", description: "Protections are limited to commercial contexts and may not cover non-commercial AI misuse." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Long-standing right of publicity statute", "40-year post-mortem protections", "No AI-specific updates"],
  },

  // Georgia — moderate
  {
    name: "Georgia",
    abbreviation: "GA",
    fips: "13",
    protectionLevel: "moderate",
    riskScore: 55,
    summary:
      "Georgia recognizes a right of publicity under common law and has codified certain protections through its privacy statutes. The state's entertainment industry presence drives ongoing interest in AI likeness legislation.",
    laws: [
      {
        name: "Georgia Code Section 51-1-36 — Right of Publicity",
        year: 2014,
        description: "Provides statutory protections against unauthorized commercial use of a person's name, image, or likeness, with enhanced protections for the entertainment industry.",
        scope: "Commercial use; enhanced protections for performers",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "Existing law does not cover AI-generated likenesses." },
      { area: "No deepfake protections", description: "No legislation targets synthetic media." },
      { area: "Limited post-mortem scope", description: "Post-mortem protections are less developed than in leading states." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Strong entertainment industry connection", "Statutory right of publicity since 2014"],
  },

  // Hawaii — basic
  {
    name: "Hawaii",
    abbreviation: "HI",
    fips: "15",
    protectionLevel: "basic",
    riskScore: 28,
    summary:
      "Hawaii has a limited statutory right of publicity and recognizes common law privacy protections. There are no AI-specific laws or pending bills addressing digital replicas or deepfakes.",
    laws: [
      {
        name: "Hawaii Revised Statutes Section 482P — Publicity Rights",
        year: 2013,
        description: "Provides a statutory right of publicity protecting against unauthorized commercial exploitation of an individual's identity.",
        scope: "Commercial exploitation of identity",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address AI-generated content." },
      { area: "No deepfake protections", description: "No legislation targets deepfakes or synthetic media." },
      { area: "Limited enforcement history", description: "Few cases have tested the scope of existing protections." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Statutory publicity rights since 2013", "No AI or deepfake legislation"],
  },

  // Idaho — basic
  {
    name: "Idaho",
    abbreviation: "ID",
    fips: "16",
    protectionLevel: "basic",
    riskScore: 25,
    summary:
      "Idaho has a statutory right of publicity that protects against commercial misappropriation of a person's identity. The law is narrow and does not address AI-generated content, deepfakes, or biometric data.",
    laws: [
      {
        name: "Idaho Code Section 48-508 — Right of Publicity",
        year: 2009,
        description: "Protects individuals from unauthorized commercial use of their name, voice, or likeness.",
        scope: "Commercial use only",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "Does not address digital replicas or AI-generated likenesses." },
      { area: "No deepfake protections", description: "No provisions for synthetic media." },
      { area: "No post-mortem protections", description: "Rights expire at death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Basic right of publicity statute", "No AI or deepfake protections"],
  },

  // Illinois — strong
  {
    name: "Illinois",
    abbreviation: "IL",
    fips: "17",
    protectionLevel: "strong",
    riskScore: 88,
    summary:
      "Illinois provides some of the strongest likeness protections in the nation through its Biometric Information Privacy Act (BIPA) and Right of Publicity Act. BIPA's private right of action and statutory damages have made it the most consequential biometric privacy law in the country.",
    laws: [
      {
        name: "Biometric Information Privacy Act (BIPA)",
        year: 2008,
        description: "Regulates the collection, storage, and use of biometric identifiers including facial geometry. Provides a private right of action with statutory damages of $1,000–$5,000 per violation.",
        scope: "Biometric data collection, storage, and use; includes facial geometry",
      },
      {
        name: "Right of Publicity Act (765 ILCS 1075)",
        year: 1999,
        description: "Protects individuals from unauthorized commercial use of their identity, including name, likeness, and voice. Provides both injunctive relief and damages.",
        scope: "Commercial use of identity; limited post-mortem protections",
      },
    ],
    gaps: [
      { area: "No AI-specific deepfake law", description: "While BIPA covers facial biometrics, there is no law specifically targeting AI-generated deepfakes." },
      { area: "Post-mortem gap", description: "Post-mortem protections are more limited than in California or Tennessee." },
    ],
    actionPaths: getActionPaths("strong"),
    highlights: [
      "BIPA provides strongest biometric protections in the U.S.",
      "Private right of action with $1,000–$5,000 per violation",
      "Right of Publicity Act since 1999",
    ],
  },

  // Indiana — moderate
  {
    name: "Indiana",
    abbreviation: "IN",
    fips: "18",
    protectionLevel: "moderate",
    riskScore: 55,
    summary:
      "Indiana has a comprehensive right of publicity statute that covers name, likeness, voice, and signature. The law includes post-mortem protections of 100 years, among the longest in the nation, but does not address AI-generated content.",
    laws: [
      {
        name: "Indiana Code 32-36 — Right of Publicity",
        year: 2012,
        description: "Provides broad right of publicity protections including name, likeness, voice, and signature. Includes 100-year post-mortem protections.",
        scope: "Broad identity protections; 100-year post-mortem rights",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address digital replicas or AI-generated content." },
      { area: "No deepfake protections", description: "No legislation targets AI-generated synthetic media." },
      { area: "No biometric protections", description: "No equivalent to Illinois BIPA." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["100-year post-mortem protections", "Broad right of publicity statute", "No AI coverage"],
  },

  // Iowa — none
  {
    name: "Iowa",
    abbreviation: "IA",
    fips: "19",
    protectionLevel: "none",
    riskScore: 12,
    summary:
      "Iowa has no statutory right of publicity and very limited common law precedent for likeness claims. The state provides no meaningful protections against AI-generated content or digital replicas.",
    laws: [],
    gaps: [
      { area: "No right of publicity", description: "Iowa has no statute or developed common law protecting likeness rights." },
      { area: "No AI-specific provisions", description: "No legislation addresses AI-generated content or deepfakes." },
      { area: "No biometric protections", description: "No laws regulate biometric data collection or use." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["No likeness protections", "No pending legislation"],
  },

  // Kansas — basic
  {
    name: "Kansas",
    abbreviation: "KS",
    fips: "20",
    protectionLevel: "basic",
    riskScore: 28,
    summary:
      "Kansas recognizes a common law right of publicity through the appropriation tort, but has no specific statute addressing likeness rights. There are no AI-specific protections or pending bills.",
    laws: [
      {
        name: "Common Law Appropriation Tort",
        year: 1974,
        description: "Kansas courts recognize appropriation of likeness as a privacy tort, providing limited protection against unauthorized commercial use.",
        scope: "Privacy-based misappropriation claims",
      },
    ],
    gaps: [
      { area: "No statutory protections", description: "Kansas relies entirely on common law." },
      { area: "No AI-specific provisions", description: "No laws address AI-generated content." },
      { area: "No post-mortem protections", description: "Common law claims are personal and do not survive death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law appropriation tort only", "No statutory or AI protections"],
  },

  // Kentucky — moderate
  {
    name: "Kentucky",
    abbreviation: "KY",
    fips: "21",
    protectionLevel: "moderate",
    riskScore: 50,
    summary:
      "Kentucky has a right of publicity statute that protects against unauthorized commercial use of an individual's name and likeness. The law provides reasonable baseline protections but does not address AI-generated content.",
    laws: [
      {
        name: "Kentucky Revised Statutes 391.170 — Right of Publicity",
        year: 2000,
        description: "Prohibits unauthorized use of a person's name, likeness, or persona for commercial purposes. Includes post-mortem protections for 50 years.",
        scope: "Commercial use of identity; 50-year post-mortem rights",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address digital replicas." },
      { area: "No deepfake protections", description: "No legislation targets AI-generated synthetic media." },
      { area: "Narrow commercial scope", description: "Protections are limited to commercial exploitation contexts." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Statutory right of publicity with 50-year post-mortem", "No AI-specific legislation"],
  },

  // Louisiana — moderate
  {
    name: "Louisiana",
    abbreviation: "LA",
    fips: "22",
    protectionLevel: "moderate",
    riskScore: 55,
    summary:
      "Louisiana has a statutory right of publicity under its Civil Code framework, protecting individuals from unauthorized commercial exploitation of their name and likeness. The state is considering AI-related amendments but has not yet enacted them.",
    laws: [
      {
        name: "Louisiana Revised Statutes 51:1141 — Right of Publicity",
        year: 2010,
        description: "Provides statutory protections against unauthorized commercial use of a person's name, image, or likeness. Includes both injunctive relief and damages.",
        scope: "Commercial exploitation of identity",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "Current law does not address AI-generated replicas or synthetic media." },
      { area: "No deepfake protections", description: "No dedicated legislation for deepfakes." },
      { area: "Limited post-mortem protections", description: "Post-mortem rights are less robust than in leading states." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Statutory right of publicity since 2010", "AI amendments under consideration"],
  },

  // Maine — basic
  {
    name: "Maine",
    abbreviation: "ME",
    fips: "23",
    protectionLevel: "basic",
    riskScore: 30,
    summary:
      "Maine recognizes common law privacy protections that can be applied to likeness claims, but has no dedicated right of publicity statute. No AI-specific legislation has been enacted.",
    laws: [
      {
        name: "Common Law Privacy Protections",
        year: 1978,
        description: "Maine courts recognize the appropriation of likeness as a privacy tort under common law.",
        scope: "Privacy-based misappropriation",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "Maine relies on common law privacy torts." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas or AI-generated content." },
      { area: "No biometric protections", description: "No biometric data privacy regulations." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law privacy protections only", "No AI or deepfake legislation"],
  },

  // Maryland — basic
  {
    name: "Maryland",
    abbreviation: "MD",
    fips: "24",
    protectionLevel: "basic",
    riskScore: 35,
    summary:
      "Maryland has limited statutory provisions and common law recognition of likeness rights. The state has shown interest in AI regulation but has not yet enacted specific protections for digital replicas.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1985,
        description: "Maryland courts recognize a common law right of publicity protecting against unauthorized commercial exploitation.",
        scope: "Commercial exploitation claims",
      },
    ],
    gaps: [
      { area: "No comprehensive publicity statute", description: "Maryland lacks a dedicated right of publicity statute." },
      { area: "No AI-specific provisions", description: "No legislation addresses digital replicas or AI-generated content." },
      { area: "No deepfake protections", description: "No laws target synthetic media." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law protections recognized", "Growing interest in AI regulation"],
  },

  // Massachusetts — moderate
  {
    name: "Massachusetts",
    abbreviation: "MA",
    fips: "25",
    protectionLevel: "moderate",
    riskScore: 58,
    summary:
      "Massachusetts has a statutory right of privacy that includes protections against commercial misappropriation of likeness. The state is actively considering AI-specific legislation given its significant tech sector.",
    laws: [
      {
        name: "Massachusetts General Laws Chapter 214, Section 3A",
        year: 1973,
        description: "Provides a statutory right to privacy that includes protection against unauthorized commercial use of a person's name, portrait, or picture.",
        scope: "Commercial use of name, portrait, and picture",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address digital replicas or AI-generated content." },
      { area: "No deepfake protections", description: "No dedicated laws for synthetic media." },
      { area: "Limited post-mortem protections", description: "Privacy rights are generally personal and may not survive death." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Statutory privacy protections since 1973", "Active AI legislation discussions"],
  },

  // Michigan — basic
  {
    name: "Michigan",
    abbreviation: "MI",
    fips: "26",
    protectionLevel: "basic",
    riskScore: 32,
    summary:
      "Michigan recognizes a common law right of publicity and has limited statutory provisions. There are no AI-specific protections, though the state has begun discussing deepfake legislation.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1982,
        description: "Michigan courts recognize common law claims for unauthorized commercial appropriation of likeness.",
        scope: "Commercial appropriation of likeness",
      },
    ],
    gaps: [
      { area: "No statutory right of publicity", description: "Michigan has no comprehensive publicity statute." },
      { area: "No AI-specific provisions", description: "No laws address AI-generated content or digital replicas." },
      { area: "No biometric protections", description: "No biometric data privacy statute comparable to Illinois BIPA." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law protections only", "Deepfake legislation under discussion"],
  },

  // Minnesota — basic
  {
    name: "Minnesota",
    abbreviation: "MN",
    fips: "27",
    protectionLevel: "basic",
    riskScore: 38,
    summary:
      "Minnesota has a statutory right of publicity that provides basic protections against unauthorized commercial use of personal identity. The law has not been updated to address AI-generated content or deepfakes.",
    laws: [
      {
        name: "Minnesota Statutes Section 325E.79 — Right of Publicity",
        year: 2005,
        description: "Prohibits unauthorized commercial use of a person's name, voice, or likeness without consent.",
        scope: "Commercial use of identity",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not cover AI-generated replicas." },
      { area: "No deepfake protections", description: "No laws address synthetic media." },
      { area: "No post-mortem protections", description: "Rights expire at death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Basic statutory right of publicity", "No AI or post-mortem protections"],
  },

  // Mississippi — none
  {
    name: "Mississippi",
    abbreviation: "MS",
    fips: "28",
    protectionLevel: "none",
    riskScore: 8,
    summary:
      "Mississippi has no statutory right of publicity and minimal common law precedent for likeness claims. There are no protections against AI-generated content or pending bills to address the gap.",
    laws: [],
    gaps: [
      { area: "No right of publicity", description: "Mississippi provides no statutory or meaningful common law protections." },
      { area: "No AI-specific provisions", description: "No legislation addresses digital replicas or deepfakes." },
      { area: "No biometric protections", description: "No biometric privacy laws exist." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["No likeness protections of any kind", "No pending legislation"],
  },

  // Missouri — basic
  {
    name: "Missouri",
    abbreviation: "MO",
    fips: "29",
    protectionLevel: "basic",
    riskScore: 35,
    summary:
      "Missouri has a statutory right of publicity under its merchandising rights statute that protects names and likenesses in commercial contexts. The law does not address AI-generated content or provide post-mortem protections.",
    laws: [
      {
        name: "Missouri Revised Statutes 564.070 — Merchandising Rights",
        year: 2004,
        description: "Provides statutory protection against unauthorized commercial use of a person's name, portrait, or picture.",
        scope: "Commercial merchandising contexts",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address AI-generated replicas." },
      { area: "No deepfake protections", description: "No legislation targets deepfakes or synthetic media." },
      { area: "No post-mortem protections", description: "Rights do not survive death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Merchandising rights statute provides baseline protection", "No AI coverage"],
  },

  // Montana — basic
  {
    name: "Montana",
    abbreviation: "MT",
    fips: "30",
    protectionLevel: "basic",
    riskScore: 25,
    summary:
      "Montana recognizes common law privacy protections but lacks a dedicated right of publicity statute. The state has no AI-specific legislation or pending bills addressing digital replicas.",
    laws: [
      {
        name: "Common Law Privacy Protections",
        year: 1990,
        description: "Montana courts recognize appropriation of likeness as a privacy tort under common law.",
        scope: "Privacy-based appropriation claims",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "Montana relies on common law protections only." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas or AI-generated content." },
      { area: "No post-mortem protections", description: "Common law claims are personal and expire at death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law privacy protections only", "No statutory or AI legislation"],
  },

  // Nebraska — basic
  {
    name: "Nebraska",
    abbreviation: "NE",
    fips: "31",
    protectionLevel: "basic",
    riskScore: 30,
    summary:
      "Nebraska has a statutory right of publicity that protects against unauthorized commercial use of an individual's likeness. The law is narrow and does not address AI-generated content or post-mortem rights.",
    laws: [
      {
        name: "Nebraska Revised Statutes Section 20-202 — Right of Publicity",
        year: 2007,
        description: "Prohibits unauthorized commercial use of a person's name, likeness, or voice.",
        scope: "Commercial use of identity",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address digital replicas." },
      { area: "No deepfake protections", description: "No laws target synthetic media." },
      { area: "No post-mortem protections", description: "Rights expire at death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Basic right of publicity statute", "No AI or post-mortem protections"],
  },

  // Nevada — moderate
  {
    name: "Nevada",
    abbreviation: "NV",
    fips: "32",
    protectionLevel: "moderate",
    riskScore: 58,
    summary:
      "Nevada has a statutory right of publicity that covers name, likeness, and voice, with post-mortem protections. The entertainment industry presence in Las Vegas drives ongoing interest in AI likeness legislation.",
    laws: [
      {
        name: "Nevada Revised Statutes Chapter 597.810 — Right of Publicity",
        year: 2007,
        description: "Protects individuals from unauthorized commercial use of their name, voice, signature, or likeness. Provides 50-year post-mortem protections.",
        scope: "Commercial identity use; 50-year post-mortem rights",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address AI-generated replicas." },
      { area: "No deepfake protections", description: "No legislation targets deepfakes or synthetic media." },
      { area: "Limited enforcement", description: "Few cases have tested the scope of protections." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["50-year post-mortem protections", "Entertainment industry interest in AI legislation"],
  },

  // New Hampshire — basic
  {
    name: "New Hampshire",
    abbreviation: "NH",
    fips: "33",
    protectionLevel: "basic",
    riskScore: 28,
    summary:
      "New Hampshire has a limited statutory right of privacy and recognizes common law publicity claims. There are no AI-specific protections or significant pending legislation.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1989,
        description: "New Hampshire courts recognize appropriation of likeness under the privacy tort framework.",
        scope: "Privacy-based commercial misappropriation",
      },
    ],
    gaps: [
      { area: "No dedicated publicity statute", description: "New Hampshire relies on common law." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas." },
      { area: "No deepfake protections", description: "No legislation targets synthetic media." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law protections only", "No AI or deepfake legislation"],
  },

  // New Jersey — moderate
  {
    name: "New Jersey",
    abbreviation: "NJ",
    fips: "34",
    protectionLevel: "moderate",
    riskScore: 60,
    summary:
      "New Jersey has a common law right of publicity that courts have applied broadly, along with statutory privacy protections. The state is actively considering AI-specific legislation to address digital replicas and deepfakes.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1979,
        description: "New Jersey courts broadly recognize the right of publicity, protecting name, likeness, and voice from unauthorized commercial use.",
        scope: "Broad commercial identity protections",
      },
      {
        name: "New Jersey Privacy Statute",
        year: 2006,
        description: "Provides additional statutory protections against invasion of privacy, including commercial appropriation of likeness.",
        scope: "Privacy-based appropriation claims with statutory remedies",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "Neither common law nor statute addresses digital replicas." },
      { area: "No deepfake protections", description: "No dedicated legislation for AI-generated synthetic media." },
      { area: "Reliance on common law", description: "Core publicity protections are judge-made rather than statutory." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Broad common law publicity rights", "AI legislation under consideration"],
  },

  // New Mexico — basic
  {
    name: "New Mexico",
    abbreviation: "NM",
    fips: "35",
    protectionLevel: "basic",
    riskScore: 25,
    summary:
      "New Mexico recognizes common law privacy protections but has no dedicated right of publicity statute. There are no AI-specific protections or significant pending legislation addressing digital replicas.",
    laws: [
      {
        name: "Common Law Privacy Protections",
        year: 1986,
        description: "New Mexico courts recognize appropriation of likeness as a privacy tort.",
        scope: "Privacy-based misappropriation claims",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "New Mexico relies entirely on common law." },
      { area: "No AI-specific provisions", description: "No laws address AI-generated content or digital replicas." },
      { area: "No post-mortem protections", description: "Privacy rights do not survive death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law privacy protections only", "No statutory or AI legislation"],
  },

  // New York — strong
  {
    name: "New York",
    abbreviation: "NY",
    fips: "36",
    protectionLevel: "strong",
    riskScore: 85,
    summary:
      "New York has one of the oldest right of publicity statutes in the nation under Civil Rights Law Sections 50–51, recently updated to address digital replicas. The state's entertainment industry makes it a leader in AI likeness protections.",
    laws: [
      {
        name: "Civil Rights Law Sections 50–51 — Right of Publicity",
        year: 1903,
        description: "Prohibits unauthorized use of a person's name, portrait, or picture for commercial purposes. Recently amended to cover digital replicas and AI-generated content.",
        scope: "Commercial use of identity; includes digital replicas",
      },
      {
        name: "Digital Replica Amendments",
        year: 2024,
        description: "Updates to the Civil Rights Law extending protections to AI-generated digital replicas of living individuals, including voice and visual likeness.",
        scope: "AI-generated digital replicas of living individuals",
      },
    ],
    gaps: [
      { area: "Post-mortem limitations", description: "Post-mortem protections are more limited than in California or Tennessee." },
      { area: "AI training data", description: "Does not directly regulate use of likenesses in AI training datasets." },
    ],
    actionPaths: getActionPaths("strong"),
    highlights: [
      "One of the oldest publicity rights statutes in the U.S.",
      "Recently updated for digital replicas",
      "Major entertainment industry hub",
    ],
  },

  // North Carolina — basic
  {
    name: "North Carolina",
    abbreviation: "NC",
    fips: "37",
    protectionLevel: "basic",
    riskScore: 30,
    summary:
      "North Carolina has a limited statutory right of publicity under its Unfair and Deceptive Trade Practices Act and recognizes common law claims. AI-generated content is not addressed by existing law.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1988,
        description: "North Carolina courts recognize a common law right of publicity protecting against unauthorized commercial appropriation of likeness.",
        scope: "Commercial misappropriation claims",
      },
    ],
    gaps: [
      { area: "No comprehensive publicity statute", description: "North Carolina lacks a dedicated right of publicity statute." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas or AI-generated content." },
      { area: "No deepfake protections", description: "No legislation targets synthetic media." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law publicity rights", "No AI-specific protections"],
  },

  // North Dakota — basic
  {
    name: "North Dakota",
    abbreviation: "ND",
    fips: "38",
    protectionLevel: "basic",
    riskScore: 25,
    summary:
      "North Dakota recognizes limited common law privacy protections that may extend to likeness claims. There are no statutory publicity rights or AI-specific legislation.",
    laws: [
      {
        name: "Common Law Privacy Protections",
        year: 1992,
        description: "North Dakota courts recognize the appropriation of likeness under the privacy tort framework.",
        scope: "Privacy-based appropriation claims",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "North Dakota has no dedicated publicity statute." },
      { area: "No AI-specific provisions", description: "No laws address AI-generated content." },
      { area: "No post-mortem protections", description: "Privacy-based rights do not survive death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Limited common law protections", "No statutory or AI legislation"],
  },

  // Ohio — moderate
  {
    name: "Ohio",
    abbreviation: "OH",
    fips: "39",
    protectionLevel: "moderate",
    riskScore: 58,
    summary:
      "Ohio has a well-developed statutory right of publicity that protects name, likeness, and persona from unauthorized commercial use. The law includes 60-year post-mortem protections but does not address AI-generated content.",
    laws: [
      {
        name: "Ohio Revised Code Section 2741 — Right of Publicity",
        year: 1999,
        description: "Provides broad right of publicity protections covering name, image, likeness, and persona. Includes 60-year post-mortem protections and statutory damages.",
        scope: "Broad identity protections; 60-year post-mortem rights",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not address digital replicas or AI-generated content." },
      { area: "No deepfake protections", description: "No dedicated legislation for synthetic media." },
      { area: "No biometric protections", description: "No biometric data privacy statute." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["60-year post-mortem protections", "Broad right of publicity statute"],
  },

  // Oklahoma — moderate
  {
    name: "Oklahoma",
    abbreviation: "OK",
    fips: "40",
    protectionLevel: "moderate",
    riskScore: 52,
    summary:
      "Oklahoma has a statutory right of publicity that protects individuals from unauthorized commercial use of their name and likeness, with 100-year post-mortem protections. The law does not address AI-generated content.",
    laws: [
      {
        name: "Oklahoma Statutes Title 21, Section 839.1A — Right of Publicity",
        year: 1995,
        description: "Prohibits unauthorized use of a person's name, voice, or likeness for commercial purposes. Provides 100-year post-mortem protections.",
        scope: "Commercial identity use; 100-year post-mortem rights",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "The statute does not cover AI-generated replicas." },
      { area: "No deepfake protections", description: "No legislation targets deepfakes or synthetic media." },
      { area: "Narrow commercial scope", description: "Protections are limited to commercial contexts." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["100-year post-mortem protections", "No AI-specific coverage"],
  },

  // Oregon — basic
  {
    name: "Oregon",
    abbreviation: "OR",
    fips: "41",
    protectionLevel: "basic",
    riskScore: 35,
    summary:
      "Oregon recognizes a common law right of publicity and has statutory privacy protections. The state has shown interest in AI regulation through its tech policy discussions but has not enacted likeness-specific legislation.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1988,
        description: "Oregon courts recognize common law claims for unauthorized commercial appropriation of likeness.",
        scope: "Commercial misappropriation claims",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "Oregon relies on common law protections." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas or AI-generated content." },
      { area: "No post-mortem protections", description: "Common law claims expire at death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law publicity rights", "Tech sector interest in AI regulation"],
  },

  // Pennsylvania — moderate
  {
    name: "Pennsylvania",
    abbreviation: "PA",
    fips: "42",
    protectionLevel: "moderate",
    riskScore: 55,
    summary:
      "Pennsylvania recognizes both common law and statutory rights of publicity. The state's privacy protections have been applied to likeness claims, and there is growing legislative interest in AI regulation.",
    laws: [
      {
        name: "Pennsylvania Common Law Right of Publicity",
        year: 1981,
        description: "Courts broadly recognize the right of publicity protecting against unauthorized commercial use of name, likeness, and persona.",
        scope: "Broad commercial identity protections",
      },
      {
        name: "Pennsylvania Unfair Trade Practices and Consumer Protection Law",
        year: 1968,
        description: "Provides additional remedies for unauthorized commercial use of likeness under deceptive practices provisions.",
        scope: "Consumer protection framework applied to likeness claims",
      },
    ],
    gaps: [
      { area: "No AI-specific provisions", description: "No laws address digital replicas or AI-generated content." },
      { area: "No dedicated publicity statute", description: "Core protections are common law rather than a dedicated statute." },
      { area: "No deepfake protections", description: "No legislation targets AI-generated synthetic media." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Broad common law publicity rights", "Consumer protection law supplements claims"],
  },

  // Rhode Island — basic
  {
    name: "Rhode Island",
    abbreviation: "RI",
    fips: "44",
    protectionLevel: "basic",
    riskScore: 30,
    summary:
      "Rhode Island has a statutory right of privacy that can be applied to likeness claims, but lacks a dedicated right of publicity statute. No AI-specific legislation has been enacted.",
    laws: [
      {
        name: "Rhode Island General Laws Section 9-1-28 — Right of Privacy",
        year: 1970,
        description: "Provides a statutory right of privacy that includes protection against appropriation of likeness for commercial use.",
        scope: "Privacy-based commercial appropriation",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "Rhode Island relies on its privacy statute for likeness claims." },
      { area: "No AI-specific provisions", description: "No laws address AI-generated content or digital replicas." },
      { area: "No post-mortem protections", description: "Privacy rights are personal and expire at death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Privacy statute applied to likeness claims", "No AI legislation"],
  },

  // South Carolina — basic
  {
    name: "South Carolina",
    abbreviation: "SC",
    fips: "45",
    protectionLevel: "basic",
    riskScore: 28,
    summary:
      "South Carolina recognizes a common law right of publicity through its privacy tort framework. There are no statutory protections specifically addressing likeness rights or AI-generated content.",
    laws: [
      {
        name: "Common Law Right of Publicity",
        year: 1990,
        description: "South Carolina courts recognize appropriation of likeness as a privacy tort.",
        scope: "Privacy-based misappropriation claims",
      },
    ],
    gaps: [
      { area: "No statutory protections", description: "South Carolina relies entirely on common law." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas." },
      { area: "No post-mortem protections", description: "Privacy-based claims do not survive death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Common law protections only", "No statutory or AI legislation"],
  },

  // South Dakota — none
  {
    name: "South Dakota",
    abbreviation: "SD",
    fips: "46",
    protectionLevel: "none",
    riskScore: 10,
    summary:
      "South Dakota has no statutory right of publicity and minimal common law precedent for likeness claims. The state provides no meaningful protections against AI-generated content or unauthorized digital replicas.",
    laws: [],
    gaps: [
      { area: "No right of publicity", description: "South Dakota provides no statutory or developed common law protections." },
      { area: "No AI-specific provisions", description: "No legislation addresses digital replicas or deepfakes." },
      { area: "No privacy-based alternatives", description: "Privacy torts have not been developed for likeness claims." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["No likeness protections", "No pending legislation"],
  },

  // Tennessee — strong
  {
    name: "Tennessee",
    abbreviation: "TN",
    fips: "47",
    protectionLevel: "strong",
    riskScore: 90,
    summary:
      "Tennessee enacted the ELVIS Act in 2024, becoming the first state to explicitly protect against AI-generated voice cloning and likeness misuse. Combined with its strong existing right of publicity statute, Tennessee provides comprehensive protections for performers and individuals.",
    laws: [
      {
        name: "ELVIS Act (Ensuring Likeness Voice and Image Security)",
        year: 2024,
        description: "First state law to explicitly address AI-generated voice cloning and digital likeness. Protects individuals from unauthorized AI replication of their voice and image.",
        scope: "AI-generated voice and visual likeness; covers all individuals",
      },
      {
        name: "Tennessee Personal Rights Protection Act",
        year: 1984,
        description: "Comprehensive right of publicity statute protecting name, likeness, and persona. Provides post-mortem protections for 10 years after death.",
        scope: "Broad identity protections; 10-year post-mortem rights",
      },
    ],
    gaps: [
      { area: "Shorter post-mortem period", description: "Post-mortem protections of 10 years are shorter than California (70 years) or Indiana (100 years)." },
      { area: "AI training data", description: "The ELVIS Act does not directly regulate use of voices or likenesses in AI training datasets." },
    ],
    actionPaths: getActionPaths("strong"),
    highlights: [
      "First state to pass AI voice/likeness protection law (ELVIS Act)",
      "Comprehensive right of publicity since 1984",
      "Strong protections for performers and musicians",
    ],
  },

  // Texas — strong
  {
    name: "Texas",
    abbreviation: "TX",
    fips: "48",
    protectionLevel: "strong",
    riskScore: 82,
    summary:
      "Texas has a robust statutory right of publicity under its Property Code that protects name, likeness, and voice. The law includes strong enforcement provisions and is complemented by the state's deepfake criminalization law targeting non-consensual synthetic media.",
    laws: [
      {
        name: "Texas Property Code Chapter 26 — Right of Publicity",
        year: 2009,
        description: "Provides comprehensive right of publicity protections covering name, voice, likeness, and persona. Includes commercial use restrictions and enforcement provisions.",
        scope: "Broad identity protections; commercial and non-commercial contexts",
      },
      {
        name: "Texas Penal Code Section 21.165 — Deepfake Criminalization",
        year: 2019,
        description: "Criminalizes the creation and distribution of deepfake videos intended to harm or defraud, including those used in elections.",
        scope: "Criminal penalties for harmful deepfakes",
      },
    ],
    gaps: [
      { area: "Limited post-mortem protections", description: "Post-mortem protections are less developed than in some leading states." },
      { area: "AI training data", description: "Laws do not address use of likenesses in AI model training." },
    ],
    actionPaths: getActionPaths("strong"),
    highlights: [
      "Comprehensive right of publicity statute",
      "Deepfake criminalization since 2019",
      "Strong enforcement provisions",
    ],
  },

  // Utah — moderate
  {
    name: "Utah",
    abbreviation: "UT",
    fips: "49",
    protectionLevel: "moderate",
    riskScore: 55,
    summary:
      "Utah has a statutory right of publicity and has been proactive on AI regulation, passing the Artificial Intelligence Policy Act. While the AI law focuses on transparency rather than likeness rights, it signals growing legislative attention.",
    laws: [
      {
        name: "Utah Code Section 45-3 — Right of Publicity",
        year: 2002,
        description: "Provides statutory protections against unauthorized commercial use of a person's name, voice, or likeness.",
        scope: "Commercial use of identity",
      },
      {
        name: "Utah Artificial Intelligence Policy Act",
        year: 2024,
        description: "Requires disclosure when AI is used in consumer-facing interactions. Does not directly address likeness rights but establishes a regulatory framework for AI.",
        scope: "AI transparency in consumer interactions",
      },
    ],
    gaps: [
      { area: "No likeness-specific AI provisions", description: "The AI Policy Act does not cover unauthorized use of likenesses." },
      { area: "No deepfake protections", description: "No dedicated legislation for deepfakes or synthetic media." },
      { area: "Limited post-mortem protections", description: "Post-mortem provisions are narrow." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["AI Policy Act shows regulatory momentum", "Statutory right of publicity"],
  },

  // Vermont — none
  {
    name: "Vermont",
    abbreviation: "VT",
    fips: "50",
    protectionLevel: "none",
    riskScore: 15,
    summary:
      "Vermont has no statutory right of publicity and limited common law recognition of likeness claims. The state provides among the weakest protections in the country for individuals concerned about AI-generated content.",
    laws: [],
    gaps: [
      { area: "No right of publicity", description: "Vermont has no statutory or well-developed common law right of publicity." },
      { area: "No AI-specific provisions", description: "No legislation addresses digital replicas or deepfakes." },
      { area: "No biometric protections", description: "No biometric privacy laws exist." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["Among the weakest likeness protections nationally", "No pending legislation"],
  },

  // Virginia — moderate
  {
    name: "Virginia",
    abbreviation: "VA",
    fips: "51",
    protectionLevel: "moderate",
    riskScore: 62,
    summary:
      "Virginia has a statutory right of publicity and has been active in privacy legislation. The state's prohibition on non-consensual pornography has been expanded to include AI-generated intimate images, making it one of the first states to address deepfake intimate content.",
    laws: [
      {
        name: "Virginia Code Section 8.01-40 — Right of Publicity",
        year: 1979,
        description: "Prohibits unauthorized use of a person's name, portrait, or picture for commercial purposes.",
        scope: "Commercial use of identity",
      },
      {
        name: "Virginia Deepfake Intimate Image Law",
        year: 2019,
        description: "Criminalizes the distribution of non-consensual intimate images, expanded to include AI-generated deepfakes.",
        scope: "Non-consensual intimate deepfakes; criminal penalties",
      },
    ],
    gaps: [
      { area: "Limited AI scope", description: "Deepfake law covers only intimate images, not all unauthorized AI likenesses." },
      { area: "No comprehensive AI likeness protections", description: "General AI-generated content beyond intimate images is not addressed." },
      { area: "Limited post-mortem protections", description: "Post-mortem rights are underdeveloped." },
    ],
    actionPaths: getActionPaths("moderate"),
    highlights: ["Early adopter of deepfake intimate image criminalization", "Statutory right of publicity"],
  },

  // Washington — strong
  {
    name: "Washington",
    abbreviation: "WA",
    fips: "53",
    protectionLevel: "strong",
    riskScore: 83,
    summary:
      "Washington has a comprehensive personality rights statute that protects name, likeness, voice, and signature with 75-year post-mortem protections. Combined with the state's strong tech sector engagement on AI policy, Washington provides robust protections.",
    laws: [
      {
        name: "Washington Personality Rights Act (RCW 63.60)",
        year: 1998,
        description: "Comprehensive personality rights statute protecting name, likeness, voice, and signature from unauthorized commercial use. Provides 75-year post-mortem protections.",
        scope: "Broad identity protections; 75-year post-mortem rights",
      },
      {
        name: "Washington Deepfake Election Law",
        year: 2023,
        description: "Prohibits the use of synthetic media to deceive voters in elections, with requirements for disclosure of AI-generated political content.",
        scope: "AI-generated content in elections",
      },
    ],
    gaps: [
      { area: "No general AI likeness law", description: "Deepfake law is limited to elections; general AI-generated likenesses are covered by the personality rights statute but not AI-specifically." },
      { area: "AI training data", description: "Laws do not address use of likenesses in AI model training." },
    ],
    actionPaths: getActionPaths("strong"),
    highlights: [
      "75-year post-mortem protections",
      "Comprehensive personality rights statute",
      "Deepfake election protections",
    ],
  },

  // West Virginia — none
  {
    name: "West Virginia",
    abbreviation: "WV",
    fips: "54",
    protectionLevel: "none",
    riskScore: 10,
    summary:
      "West Virginia has no statutory right of publicity and very limited common law precedent. There are no protections addressing AI-generated content or digital replicas, and no significant legislation is pending.",
    laws: [],
    gaps: [
      { area: "No right of publicity", description: "West Virginia provides no statutory protections for likeness rights." },
      { area: "No AI-specific provisions", description: "No legislation addresses digital replicas or deepfakes." },
      { area: "No common law development", description: "Minimal judicial precedent for likeness claims." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["No likeness protections", "No pending AI legislation"],
  },

  // Wisconsin — basic
  {
    name: "Wisconsin",
    abbreviation: "WI",
    fips: "55",
    protectionLevel: "basic",
    riskScore: 32,
    summary:
      "Wisconsin has a statutory right of privacy that includes protections against commercial appropriation of likeness. The law is limited and does not address AI-generated content or provide post-mortem protections.",
    laws: [
      {
        name: "Wisconsin Statutes Section 995.50 — Right of Privacy",
        year: 1977,
        description: "Provides a statutory right of privacy that includes protection against unreasonable use of a person's likeness for commercial purposes.",
        scope: "Privacy-based commercial appropriation",
      },
    ],
    gaps: [
      { area: "No right of publicity statute", description: "Wisconsin uses a privacy framework rather than a dedicated publicity statute." },
      { area: "No AI-specific provisions", description: "No laws address digital replicas or AI-generated content." },
      { area: "No post-mortem protections", description: "Privacy rights expire at death." },
    ],
    actionPaths: getActionPaths("basic"),
    highlights: ["Privacy statute covers commercial appropriation", "No AI-specific legislation"],
  },

  // Wyoming — none
  {
    name: "Wyoming",
    abbreviation: "WY",
    fips: "56",
    protectionLevel: "none",
    riskScore: 5,
    summary:
      "Wyoming has no statutory right of publicity and no meaningful common law precedent for likeness claims. The state provides the least protection in the nation for individuals concerned about AI-generated content.",
    laws: [],
    gaps: [
      { area: "No right of publicity", description: "Wyoming has no statutory or common law right of publicity." },
      { area: "No AI-specific provisions", description: "No legislation addresses digital replicas or deepfakes." },
      { area: "No privacy-based alternatives", description: "Privacy torts have not been applied to likeness claims." },
    ],
    actionPaths: getActionPaths("none"),
    highlights: ["Weakest likeness protections in the U.S.", "No pending legislation"],
  },
];

// ---------------------------------------------------------------------------
// Helper lookups
// ---------------------------------------------------------------------------

export const statesByAbbreviation: Record<string, StateData> = Object.fromEntries(
  statesData.map((s) => [s.abbreviation, s]),
);

export const statesByFips: Record<string, StateData> = Object.fromEntries(
  statesData.map((s) => [s.fips, s]),
);
