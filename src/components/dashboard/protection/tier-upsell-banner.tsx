import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { getTierCapabilities } from "@/lib/tier-capabilities";

interface TierUpsellBannerProps {
  tier: string;
}

export function TierUpsellBanner({ tier }: TierUpsellBannerProps) {
  const capabilities = getTierCapabilities(tier);

  if (!capabilities.upgradeTarget) return null;

  return (
    <Card className="border-border/50 border-l-primary border-l-4 bg-card rounded-2xl">
      <CardContent className="p-5 sm:p-6">
        <h3 className="font-semibold text-base mb-1">
          {capabilities.upgradeHeading}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {capabilities.upgradeDescription}
        </p>
        <ul className="space-y-2 mb-5">
          {capabilities.upgradeFeatures.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-sm">
                {feature.label}
                {feature.current && (
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    ({feature.current})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <Button asChild size="sm" className="rounded-full">
          <Link href="/dashboard/account">{capabilities.upgradeCtaLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
