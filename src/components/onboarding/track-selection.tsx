"use client";

import { useOnboardingStore } from "@/stores/onboarding-store";
import { StepContainer } from "./step-container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Camera, Flame, ArrowRight } from "lucide-react";

const tracks = [
  {
    id: "sfw" as const,
    icon: Camera,
    title: "Lifestyle",
    badge: "SFW",
    description:
      "Your photos train AI for fashion, lifestyle, and social media content. Think brand campaigns, digital influencers, and editorial imagery.",
    details: ["Fashion & lifestyle AI models", "Social media content generation", "Brand ambassador AI"],
  },
  {
    id: "nsfw" as const,
    icon: Flame,
    title: "Premium",
    badge: "NSFW",
    description:
      "Your photos train AI for adult content on age-verified platforms only. Everything is handled with the same security and consent protections as the Lifestyle track.",
    details: ["Adult AI content on verified platforms", "Same privacy and security protections", "Age-verified platforms only"],
  },
];

export function TrackSelection() {
  const { trackType, setTrackType, setStep } = useOnboardingStore();

  return (
    <StepContainer
      title="Choose Your Track"
      description="This decides what kind of AI your photos help train. No wrong choice — and you can switch later."
    >
      <div className="grid sm:grid-cols-2 gap-6 mb-4">
        {tracks.map((track) => (
          <Card
            key={track.id}
            className={cn(
              "cursor-pointer transition-all border-2 hover:border-neon/50 rounded-2xl",
              trackType === track.id
                ? "border-neon bg-neon/5 neon-glow"
                : "border-border/50 bg-card/50"
            )}
            onClick={() => setTrackType(track.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center">
                  <track.icon className="w-6 h-6 text-neon" />
                </div>
                <Badge
                  variant={trackType === track.id ? "default" : "secondary"}
                  className="text-xs"
                >
                  {track.badge}
                </Badge>
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold mb-2">
                {track.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {track.description}
              </p>
              <ul className="space-y-2">
                {track.details.map((detail) => (
                  <li
                    key={detail}
                    className="text-xs text-muted-foreground flex items-center gap-2"
                  >
                    <div className="w-1 h-1 rounded-full bg-neon" />
                    {detail}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {trackType === "nsfw" && (
        <p className="text-xs text-trust-muted text-center mb-4">
          Your track choice is private and never displayed publicly. All
          contributors receive the same identity protections regardless of
          track.
        </p>
      )}

      <div className="flex justify-end mt-4">
        <Button
          onClick={() => setStep(2)}
          disabled={!trackType}
          className="neon-glow"
        >
          Continue
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </StepContainer>
  );
}
