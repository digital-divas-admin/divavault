"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Gem, Sparkles } from "lucide-react";

const tiers = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    annualTotal: 0,
    description: "Basic monitoring to get started",
    features: [
      "Weekly scans",
      "2 platforms monitored",
      "Basic match alerts",
      "3 known accounts",
    ],
    cta: "Get Started",
    badge: null,
    featured: false,
  },
  {
    id: "protected",
    name: "Protected",
    monthlyPrice: 19,
    annualPrice: 15,
    annualTotal: 180,
    description: "Full protection for creators",
    features: [
      "Daily scans",
      "All platforms monitored",
      "Automated DMCA takedowns",
      "AI detection results",
      "10 known accounts",
      "Full match details & evidence",
    ],
    cta: "Start Protection",
    badge: { label: "MOST POPULAR", icon: "gem" as const },
    featured: true,
  },
  {
    id: "premium",
    name: "Premium",
    monthlyPrice: 49,
    annualPrice: 39,
    annualTotal: 468,
    description: "Maximum protection + legal support",
    features: [
      "Scans every 6 hours",
      "All platforms monitored",
      "Legal consultation access",
      "Multi-person protection",
      "API access",
      "25 known accounts",
    ],
    cta: "Go Premium",
    badge: { label: "BEST VALUE", icon: "sparkles" as const },
    featured: false,
  },
];

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-center mb-4">
          Choose Your Protection
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          Start free. Upgrade when you need more.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12 sm:mb-16">
          <span
            className={`text-sm font-medium transition-colors ${
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Monthly
          </span>
          <button
            role="switch"
            aria-checked={isAnnual}
            aria-label="Toggle annual billing"
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
              isAnnual ? "bg-primary" : "bg-secondary"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                isAnnual ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors ${
              isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Annual
          </span>
          <Badge className="bg-green-500 text-white border-transparent text-xs font-bold uppercase tracking-wide">
            2 months free
          </Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {tiers.map((tier) => {
            const isFree = tier.monthlyPrice === 0;
            const displayPrice = isFree
              ? 0
              : isAnnual
                ? tier.annualPrice
                : tier.monthlyPrice;
            const ctaHref = isFree
              ? "/signup"
              : `/signup?plan=${tier.id}&interval=${isAnnual ? "annual" : "monthly"}`;

            return (
              <div
                key={tier.name}
                className={`bg-card border rounded-2xl p-6 sm:p-8 relative ${
                  tier.featured
                    ? "border-primary ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
                        tier.featured
                          ? "bg-primary text-primary-foreground"
                          : "bg-green-500 text-white"
                      }`}
                    >
                      {tier.badge.icon === "gem" ? (
                        <Gem className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {tier.badge.label}
                    </span>
                  </div>
                )}

                <h3 className="font-[family-name:var(--font-heading)] text-2xl mb-1 mt-2">
                  {tier.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

                <div className="mb-6">
                  {!isFree && isAnnual && (
                    <span className="text-lg text-muted-foreground line-through mr-2">
                      ${tier.monthlyPrice}
                    </span>
                  )}
                  <span className="text-4xl font-bold">${displayPrice}</span>
                  <span className="text-muted-foreground text-sm ml-1">
                    {isFree ? "forever" : "/mo"}
                  </span>
                  {!isFree && isAnnual && (
                    <div className="text-xs text-muted-foreground mt-1">
                      billed ${tier.annualTotal}/year
                    </div>
                  )}
                </div>

                <Button
                  asChild
                  className={`w-full rounded-full mb-6 ${
                    tier.featured ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Link href={ctaHref}>{tier.cta}</Link>
                </Button>

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
