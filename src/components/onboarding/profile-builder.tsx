"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { StepContainer } from "./step-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const HAIR_COLORS = [
  { value: "black", label: "Black", color: "#1a1a1a" },
  { value: "dark_brown", label: "Dark Brown", color: "#3b2314" },
  { value: "light_brown", label: "Light Brown", color: "#8b6914" },
  { value: "blonde", label: "Blonde", color: "#d4a843" },
  { value: "red", label: "Red", color: "#a0422a" },
  { value: "auburn", label: "Auburn", color: "#6e3020" },
  { value: "gray", label: "Gray", color: "#9e9e9e" },
  { value: "white", label: "White", color: "#e8e8e8" },
  { value: "other", label: "Other", color: null },
];

const EYE_COLORS = [
  { value: "brown", label: "Brown", color: "#5c3317" },
  { value: "dark_brown", label: "Dark Brown", color: "#3b1e0e" },
  { value: "hazel", label: "Hazel", color: "#8e7618" },
  { value: "green", label: "Green", color: "#2e8b57" },
  { value: "blue", label: "Blue", color: "#4169e1" },
  { value: "gray", label: "Gray", color: "#778899" },
  { value: "amber", label: "Amber", color: "#c48200" },
  { value: "other", label: "Other", color: null },
];

const SKIN_TONES = [
  { value: "very_light", label: "Very Light", color: "#ffe0bd" },
  { value: "light", label: "Light", color: "#f5c8a8" },
  { value: "medium_light", label: "Medium Light", color: "#dba878" },
  { value: "medium", label: "Medium", color: "#c49060" },
  { value: "medium_dark", label: "Medium Dark", color: "#a06835" },
  { value: "dark", label: "Dark", color: "#7b4b2a" },
  { value: "very_dark", label: "Very Dark", color: "#4a2c17" },
];

const BODY_TYPES = [
  { value: "slim", label: "Slim" },
  { value: "athletic", label: "Athletic" },
  { value: "average", label: "Average" },
  { value: "curvy", label: "Curvy" },
  { value: "plus_size", label: "Plus Size" },
];

const AGE_RANGES = [
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55+", label: "55+" },
];

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const ETHNICITIES = [
  { value: "asian", label: "Asian" },
  { value: "black", label: "Black / African" },
  { value: "hispanic_latino", label: "Hispanic / Latino" },
  { value: "middle_eastern", label: "Middle Eastern / North African" },
  { value: "native_american", label: "Native American / Indigenous" },
  { value: "pacific_islander", label: "Pacific Islander" },
  { value: "south_asian", label: "South Asian" },
  { value: "white", label: "White / European" },
  { value: "multiracial", label: "Multiracial" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

interface ColorSwatchPickerProps {
  label: string;
  description: string;
  options: Array<{ value: string; label: string; color: string | null }>;
  selected: string | null;
  onSelect: (value: string) => void;
}

function ColorSwatchPicker({
  label,
  description,
  options,
  selected,
  onSelect,
}: ColorSwatchPickerProps) {
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
              selected === opt.value
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border/50 hover:border-primary/30"
            )}
          >
            {opt.color && (
              <span
                className="w-4 h-4 rounded-full border border-border/30 shrink-0"
                style={{ backgroundColor: opt.color }}
              />
            )}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChipPickerProps {
  label: string;
  description: string;
  options: Array<{ value: string; label: string }>;
  selected: string | null;
  onSelect: (value: string) => void;
}

function ChipPicker({
  label,
  description,
  options,
  selected,
  onSelect,
}: ChipPickerProps) {
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "px-4 py-2 rounded-lg border text-sm transition-all",
              selected === opt.value
                ? "border-primary bg-primary/5 text-primary font-medium ring-2 ring-primary/20"
                : "border-border/50 hover:border-primary/30"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfileBuilder() {
  const { profileData, setProfileData, setProfileCompleted, setStep } =
    useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    profileData.hairColor &&
    profileData.eyeColor &&
    profileData.skinTone &&
    profileData.bodyType &&
    profileData.ageRange &&
    profileData.gender;

  async function handleContinue() {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save profile.");
        setSubmitting(false);
        return;
      }

      setProfileCompleted(true);
      setStep(3);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <StepContainer
      title="Build Your Profile"
      description="Help us understand your appearance so we can match you with the right opportunities. All fields are private by default."
    >
      <Card className="border-border/50 bg-card rounded-2xl mb-6">
        <CardContent className="p-5 sm:p-6 space-y-6">
          <ColorSwatchPicker
            label="Hair Color"
            description="Select the closest match to your natural or current hair color."
            options={HAIR_COLORS}
            selected={profileData.hairColor}
            onSelect={(v) => setProfileData({ hairColor: v })}
          />

          <ColorSwatchPicker
            label="Eye Color"
            description="Select the closest match."
            options={EYE_COLORS}
            selected={profileData.eyeColor}
            onSelect={(v) => setProfileData({ eyeColor: v })}
          />

          <ColorSwatchPicker
            label="Skin Tone"
            description="Used for lighting and diversity matching."
            options={SKIN_TONES}
            selected={profileData.skinTone}
            onSelect={(v) => setProfileData({ skinTone: v })}
          />

          <ChipPicker
            label="Body Type"
            description="Select the option that best describes you."
            options={BODY_TYPES}
            selected={profileData.bodyType}
            onSelect={(v) => setProfileData({ bodyType: v })}
          />

          <ChipPicker
            label="Age Range"
            description="Select your age range."
            options={AGE_RANGES}
            selected={profileData.ageRange}
            onSelect={(v) => setProfileData({ ageRange: v })}
          />

          <ChipPicker
            label="Gender"
            description="How you identify."
            options={GENDERS}
            selected={profileData.gender}
            onSelect={(v) => setProfileData({ gender: v })}
          />

          <ChipPicker
            label="Ethnicity"
            description="Optional. Helps with diversity in AI training."
            options={ETHNICITIES}
            selected={profileData.ethnicity}
            onSelect={(v) => setProfileData({ ethnicity: v })}
          />

          <div>
            <Label htmlFor="selfDescription" className="text-sm font-semibold">
              Anything else? (optional)
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Distinguishing features, tattoos, piercings, etc.
            </p>
            <Textarea
              id="selfDescription"
              placeholder="e.g., Full sleeve tattoo on left arm, septum piercing"
              value={profileData.selfDescription || ""}
              onChange={(e) =>
                setProfileData({ selfDescription: e.target.value || null })
              }
              maxLength={500}
              className="resize-none"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/10 bg-primary/5 rounded-2xl mb-6">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            Your profile attributes are private by default. You can choose to
            share individual fields later from your dashboard to get matched
            with relevant bounty requests.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-sm mb-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!isValid || submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </StepContainer>
  );
}
