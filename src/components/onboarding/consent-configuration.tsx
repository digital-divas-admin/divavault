"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { generateConsentHash } from "@/lib/consent-hash";
import { StepContainer } from "./step-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeoRestriction, ContentExclusion } from "@/types/capture";

const CONSENT_VERSION = "2.0";

interface CoreConsentSection {
  id: string;
  title: string;
  plainIntro: string;
  items: string[];
  checkboxLabel: string;
  storeKey:
    | "consentAge"
    | "consentAiTraining"
    | "consentLikeness"
    | "consentRevocation"
    | "consentPrivacy";
  setter:
    | "setConsentAge"
    | "setConsentAiTraining"
    | "setConsentLikeness"
    | "setConsentRevocation"
    | "setConsentPrivacy";
}

const CORE_SECTIONS: CoreConsentSection[] = [
  {
    id: "age",
    title: "Age & Identity",
    plainIntro:
      "First, the basics: you're confirming you're an adult and that the photos are really you.",
    items: [
      "I certify that I am at least 18 years of age.",
      "All photos I have contributed depict only myself, or I have obtained consent from every individual depicted.",
      "The name and identity information I have provided is accurate and truthful.",
    ],
    checkboxLabel: "I confirm my age and identity information is accurate",
    storeKey: "consentAge",
    setter: "setConsentAge",
  },
  {
    id: "ai-training",
    title: "How Your Photos Will Be Used",
    plainIntro:
      "This is the core agreement. You're giving us permission to use your photos to train AI models that generate synthetic images.",
    items: [
      "I grant Made Of Us and its affiliates a non-exclusive, worldwide, royalty-bearing license to use my contributed photos for the purpose of AI model training.",
      "My photos may be used to train generative AI models that produce synthetic images.",
    ],
    checkboxLabel: "I agree to let my photos be used for AI model training",
    storeKey: "consentAiTraining",
    setter: "setConsentAiTraining",
  },
  {
    id: "likeness",
    title: "Your Likeness in AI Content",
    plainIntro:
      "AI models trained on your photos may generate images that look like you. Those images could appear in commercial content.",
    items: [
      "I grant the right to use my name, likeness, image, and persona in connection with AI model training.",
      "AI models trained on my likeness may generate synthetic images that resemble me.",
      "My likeness may appear in commercial AI-generated content produced by licensed users of trained models.",
    ],
    checkboxLabel:
      "I understand my likeness may appear in AI-generated content",
    storeKey: "consentLikeness",
    setter: "setConsentLikeness",
  },
  {
    id: "revocation",
    title: "Opting Out",
    plainIntro:
      "You can leave anytime. But once an AI model is trained, that training can't be undone.",
    items: [
      "I understand I may revoke my consent at any time from my dashboard.",
      "Upon revocation, my photos will be removed from all future training data sets.",
      "I understand that AI models already trained on my data cannot be un-trained.",
      "I understand that my identity verification records will be retained for 7 years in accordance with legal requirements.",
    ],
    checkboxLabel:
      "I understand how opting out works, including its limitations",
    storeKey: "consentRevocation",
    setter: "setConsentRevocation",
  },
  {
    id: "privacy",
    title: "Privacy & Data Storage",
    plainIntro:
      "Your photos live in encrypted cloud storage that only our systems can access.",
    items: [
      "I acknowledge that my photos will be stored in encrypted cloud storage operated by Made Of Us.",
      "I acknowledge the data retention practices described in the Privacy Policy.",
    ],
    checkboxLabel: "I acknowledge the privacy and data retention practices",
    storeKey: "consentPrivacy",
    setter: "setConsentPrivacy",
  },
];

const USAGE_CATEGORIES = [
  {
    key: "allowCommercial" as const,
    label: "Commercial",
    description: "Advertising, marketing, product imagery",
  },
  {
    key: "allowEditorial" as const,
    label: "Editorial",
    description: "News, journalism, educational articles",
  },
  {
    key: "allowEntertainment" as const,
    label: "Entertainment",
    description: "Film, gaming, social media content",
  },
  {
    key: "allowELearning" as const,
    label: "E-Learning",
    description: "Online courses, training materials",
  },
];

const GEO_OPTIONS: Array<{ value: GeoRestriction; label: string }> = [
  { value: "global", label: "Global (everywhere)" },
  { value: "US", label: "United States" },
  { value: "EU", label: "European Union" },
  { value: "UK", label: "United Kingdom" },
  { value: "APAC", label: "Asia Pacific" },
  { value: "LATAM", label: "Latin America" },
  { value: "MENA", label: "Middle East & North Africa" },
];

const CONTENT_EXCLUSIONS: Array<{
  value: ContentExclusion;
  label: string;
}> = [
  { value: "political", label: "Political" },
  { value: "religious", label: "Religious" },
  { value: "tobacco", label: "Tobacco" },
  { value: "alcohol", label: "Alcohol" },
  { value: "gambling", label: "Gambling" },
  { value: "weapons", label: "Weapons" },
  { value: "adult_adjacent", label: "Adult-Adjacent" },
];

export function ConsentConfiguration() {
  const store = useOnboardingStore();
  const {
    setStep,
    allConsentsGiven,
    allowCommercial,
    allowEditorial,
    allowEntertainment,
    allowELearning,
    setAllowCommercial,
    setAllowEditorial,
    setAllowEntertainment,
    setAllowELearning,
    geoRestrictions,
    setGeoRestrictions,
    contentExclusions,
    toggleContentExclusion,
  } = store;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = allConsentsGiven();

  const usageSetter = {
    allowCommercial: setAllowCommercial,
    allowEditorial: setAllowEditorial,
    allowEntertainment: setAllowEntertainment,
    allowELearning: setAllowELearning,
  } as const;

  const usageValue = {
    allowCommercial,
    allowEditorial,
    allowEntertainment,
    allowELearning,
  } as const;

  function handleGeoToggle(geo: GeoRestriction) {
    if (geo === "global") {
      setGeoRestrictions(["global"]);
      return;
    }
    const filtered = geoRestrictions.filter((g) => g !== "global");
    if (filtered.includes(geo)) {
      const remaining = filtered.filter((g) => g !== geo);
      setGeoRestrictions(remaining.length === 0 ? ["global"] : remaining);
    } else {
      setGeoRestrictions([...filtered, geo]);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const consentData = {
        consentAge: store.consentAge,
        consentAiTraining: store.consentAiTraining,
        consentLikeness: store.consentLikeness,
        consentRevocation: store.consentRevocation,
        consentPrivacy: store.consentPrivacy,
        allowCommercial,
        allowEditorial,
        allowEntertainment,
        allowELearning,
        geoRestrictions,
        contentExclusions,
        consentVersion: CONSENT_VERSION,
      };

      const consentHash = await generateConsentHash(consentData);

      const res = await fetch("/api/onboarding/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...consentData,
          consentHash,
          userAgent: navigator.userAgent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save consent.");
        setSubmitting(false);
        return;
      }

      setStep(4);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <StepContainer
      title="Consent & Preferences"
      description="Read through each section carefully. You're choosing exactly how your likeness can be used."
    >
      {/* Emotional intro */}
      <Card className="border-secondary/20 bg-secondary/5 rounded-2xl mb-6">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sharing your photos for AI training is a meaningful decision. Below,
            we&apos;ve broken down exactly what you&apos;re agreeing to, plus
            new controls that let you decide <em>how</em> your likeness is used.
          </p>
        </CardContent>
      </Card>

      {/* Core consent sections */}
      <div className="space-y-4 mb-6">
        {CORE_SECTIONS.map((section) => (
          <Card
            key={section.id}
            className="border-border/50 bg-card rounded-2xl"
          >
            <CardContent className="p-6">
              <h3 className="font-semibold text-sm mb-3">{section.title}</h3>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                {section.plainIntro}
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground/60 shrink-0">
                      &bull;
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/30">
                <Checkbox
                  id={`consent-${section.id}`}
                  checked={store[section.storeKey]}
                  onCheckedChange={(checked) =>
                    store[section.setter](checked === true)
                  }
                />
                <label
                  htmlFor={`consent-${section.id}`}
                  className="text-sm font-medium cursor-pointer select-none"
                >
                  {section.checkboxLabel}
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Granular usage preferences */}
      <Card className="border-border/50 bg-card rounded-2xl mb-4">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Usage Categories</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Choose which types of AI-generated content your likeness can appear
            in. All are enabled by default — toggle off any you&apos;re not
            comfortable with.
          </p>
          <div className="space-y-3">
            {USAGE_CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30"
              >
                <div>
                  <Label className="text-sm font-medium">{cat.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
                <Switch
                  checked={usageValue[cat.key]}
                  onCheckedChange={(v) => usageSetter[cat.key](v)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Geographic restrictions */}
      <Card className="border-border/50 bg-card rounded-2xl mb-4">
        <CardContent className="p-6">
          <h3 className="font-semibold text-sm mb-1">
            Geographic Availability
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Where can AI-generated content using your likeness be distributed?
            Select specific regions or keep it global.
          </p>
          <div className="flex flex-wrap gap-2">
            {GEO_OPTIONS.map((geo) => (
              <button
                key={geo.value}
                type="button"
                onClick={() => handleGeoToggle(geo.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm transition-all",
                  geoRestrictions.includes(geo.value)
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border/50 hover:border-primary/30"
                )}
              >
                {geo.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content exclusions */}
      <Card className="border-border/50 bg-card rounded-2xl mb-6">
        <CardContent className="p-6">
          <h3 className="font-semibold text-sm mb-1">Content Exclusions</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Are there any content categories you want to block your likeness
            from appearing in? Select any that apply.
          </p>
          <div className="flex flex-wrap gap-2">
            {CONTENT_EXCLUSIONS.map((exc) => (
              <Badge
                key={exc.value}
                variant={
                  contentExclusions.includes(exc.value)
                    ? "default"
                    : "outline"
                }
                className={cn(
                  "cursor-pointer transition-all select-none",
                  contentExclusions.includes(exc.value)
                    ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                    : "hover:border-primary/30"
                )}
                onClick={() => toggleContentExclusion(exc.value)}
              >
                {exc.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version */}
      <div className="text-xs text-muted-foreground/60 mb-6 px-1">
        <p>Consent Agreement v{CONSENT_VERSION}</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-sm mb-4">
          <p className="font-medium text-destructive mb-1">
            We couldn&apos;t save your agreement
          </p>
          <p className="text-destructive/80">{error}</p>
          <p className="text-muted-foreground text-xs mt-2">
            Your selections are still saved locally. You can try again without
            re-checking everything.
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(2)}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </StepContainer>
  );
}
