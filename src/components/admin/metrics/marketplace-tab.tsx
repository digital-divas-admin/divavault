"use client";

import { MetricCard } from "./metric-card";
import { SectionHeader } from "./section-header";
import { Lightbulb } from "lucide-react";

interface MarketplaceTabProps {
  data: {
    optedInPercentage: number;
    optedInChange: number;
    brandWaitlist: number;
    brandWaitlistChange: number;
    conciergeBriefs: number;
    conciergeBriefsChange: number;
    demographics: {
      ageGroups: {
        label: string;
        count: number;
        total: number;
        percentage: number;
      }[];
      genderGroups: {
        label: string;
        count: number;
        total: number;
        percentage: number;
      }[];
    };
  };
}

export function MarketplaceTab({ data }: MarketplaceTabProps) {
  const { ageGroups, genderGroups } = data.demographics;
  const hasAgeData = ageGroups.some((g) => g.count > 0);
  const hasGenderData = genderGroups.some((g) => g.count > 0);

  // Find underrepresented age group for insight
  const underrepresented = ageGroups
    .filter((g) => g.count > 0)
    .sort((a, b) => a.percentage - b.percentage)[0];

  return (
    <div className="space-y-8">
      <SectionHeader
        label="Marketplace"
        title="Marketplace Readiness"
        description="Contributor pool demographics and brand demand signals"
      />

      {/* TODO: All marketplace metric cards are mock — requires opt-in flag, brand waitlist, brief tracking */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Opted In"
          value={`${data.optedInPercentage}%`}
          change={data.optedInChange}
          changeType={data.optedInChange > 0 ? "positive" : "neutral"}
          subtitle="Mock data"
        />
        <MetricCard
          label="Brand Waitlist"
          value={data.brandWaitlist}
          change={data.brandWaitlistChange}
          changeType={data.brandWaitlistChange > 0 ? "positive" : "neutral"}
          subtitle="Mock data"
        />
        <MetricCard
          label="Concierge Briefs"
          value={data.conciergeBriefs}
          change={data.conciergeBriefsChange}
          changeType={data.conciergeBriefsChange > 0 ? "positive" : "neutral"}
          subtitle="Mock data"
        />
      </div>

      {/* Demographic coverage — real data from contributor_attributes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/30 p-5">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            Age Distribution
          </p>
          {hasAgeData ? (
            <div className="space-y-3">
              {ageGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{group.label}</span>
                    <span className="text-muted-foreground">
                      {group.count} ({group.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${group.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No demographic data yet
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border/30 p-5">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            Gender Distribution
          </p>
          {hasGenderData ? (
            <div className="space-y-3">
              {genderGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{group.label}</span>
                    <span className="text-muted-foreground">
                      {group.count} ({group.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${group.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No demographic data yet
            </div>
          )}
        </div>
      </div>

      {/* Recruitment insight */}
      {underrepresented && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Recruitment Priority
            </p>
            <p className="text-sm text-blue-700 mt-1">
              The {underrepresented.label} age group is underrepresented at{" "}
              {underrepresented.percentage}% of your pool. Consider targeted
              outreach to improve demographic coverage.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground italic">
        Marketplace readiness cards use mock data. TODO: Add opt-in flag,
        brand waitlist table, and concierge brief tracking.
        Demographic coverage uses real contributor_attributes data.
      </p>
    </div>
  );
}
