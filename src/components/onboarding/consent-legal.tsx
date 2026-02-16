"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { StepContainer } from "./step-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2 } from "lucide-react";

const CONSENT_VERSION = "1.0";

interface ConsentSection {
  id: string;
  title: string;
  plainIntro?: string;
  items: string[];
  checkboxLabel?: string;
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

const BASE_SECTIONS: ConsentSection[] = [
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
      "I grant Consented AI and its affiliates a non-exclusive, worldwide, royalty-bearing license to use my contributed photos for the purpose of AI model training.",
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
      "AI models trained on your photos may generate images that look like you. Those images could appear in commercial content. This is the part where you're saying that's okay.",
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
    title: "Opting Out — What You Should Know",
    plainIntro:
      "You can leave anytime. But we want to be honest: once an AI model is trained, that training can't be undone. Your photos will be removed from future training, but existing models may retain learned patterns.",
    items: [
      "I understand I may revoke my consent at any time from my dashboard.",
      "Upon revocation, my photos will be removed from all future training data sets.",
      "I understand that AI models already trained on my data cannot be un-trained, and synthetic outputs generated prior to revocation may continue to exist.",
      "I understand that my identity verification records will be retained for 7 years in accordance with legal requirements.",
    ],
    checkboxLabel:
      "I understand how opting out works, including its limitations",
    storeKey: "consentRevocation",
    setter: "setConsentRevocation",
  },
  {
    id: "privacy",
    title: "Privacy & How We Store Your Data",
    plainIntro:
      "Your photos live in encrypted cloud storage that only our systems can access.",
    items: [
      "I acknowledge that my photos will be stored in encrypted cloud storage operated by Consented AI.",
      "I acknowledge the data retention practices described in the Privacy Policy.",
    ],
    checkboxLabel: "I acknowledge the privacy and data retention practices",
    storeKey: "consentPrivacy",
    setter: "setConsentPrivacy",
  },
];

export function ConsentLegal() {
  const router = useRouter();
  const store = useOnboardingStore();
  const {
    setStep,
    selectedPhotoIds,
    uploadedPhotos,
    instagramMedia,
    allConsentsGiven,
    reset,
  } = store;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = BASE_SECTIONS;

  const canSubmit = allConsentsGiven();

  async function handleComplete() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentAge: store.consentAge,
          consentAiTraining: store.consentAiTraining,
          consentLikeness: store.consentLikeness,
          consentRevocation: store.consentRevocation,
          consentPrivacy: store.consentPrivacy,
          consentVersion: CONSENT_VERSION,
          uploadedPhotos,
          selectedPhotoIds,
          instagramMedia: instagramMedia.map((m) => ({
            id: m.id,
            media_url: m.media_url,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      reset();
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <StepContainer
      title="Review & Agree"
      description="This is the important part. Read through each section at your own pace — there's no timer. Every checkbox is something you're actively choosing."
    >
      {/* Emotional intro card */}
      <Card className="border-secondary/20 bg-secondary/5 rounded-2xl mb-6">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sharing your photos for AI training is a meaningful decision, and we
            want you to feel confident about it. Below, we&apos;ve broken down
            exactly what you&apos;re agreeing to. If anything feels unclear,
            take a moment — you can always come back to this step.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4 mb-6">
        {sections.map((section) => (
          <Card
            key={section.id}
            className="border-border/50 bg-card rounded-2xl"
          >
            <CardContent className="p-6">
              <h3 className="font-semibold text-sm mb-3">{section.title}</h3>
              {section.plainIntro && (
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  {section.plainIntro}
                </p>
              )}
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
                  {section.checkboxLabel || "I have read and agree to the above"}
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Version */}
      <div className="text-xs text-muted-foreground/60 mb-6 space-y-2 px-1">
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
        <Button
          onClick={handleComplete}
          disabled={!canSubmit || submitting}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit & Complete
        </Button>
      </div>
    </StepContainer>
  );
}
