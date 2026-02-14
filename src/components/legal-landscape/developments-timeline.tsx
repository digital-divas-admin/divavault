"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { developments } from "@/data/legal-landscape/developments";
import type { DevelopmentCategory } from "@/data/legal-landscape/types";

const CATEGORY_CONFIG: Record<
  DevelopmentCategory,
  { label: string; color: string; badgeVariant: "purple" | "outline" | "destructive" | "success" }
> = {
  legislation: {
    label: "Legislation",
    color: "#8B5CF6",
    badgeVariant: "purple",
  },
  "court-ruling": {
    label: "Court Rulings",
    color: "#3B82F6",
    badgeVariant: "outline",
  },
  enforcement: {
    label: "Enforcement",
    color: "#EF4444",
    badgeVariant: "destructive",
  },
  industry: {
    label: "Industry",
    color: "#22C55E",
    badgeVariant: "success",
  },
};

const ALL_CATEGORIES: DevelopmentCategory[] = [
  "legislation",
  "court-ruling",
  "enforcement",
  "industry",
];

export function DevelopmentsTimeline() {
  const [activeCategories, setActiveCategories] = useState<
    Set<DevelopmentCategory>
  >(new Set(ALL_CATEGORIES));

  const toggleCategory = (category: DevelopmentCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        // Don't allow deselecting all
        if (next.size > 1) {
          next.delete(category);
        }
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const filteredEvents = useMemo(
    () => developments.filter((event) => activeCategories.has(event.category)),
    [activeCategories]
  );

  return (
    <div className="space-y-6">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((category) => {
          const config = CATEGORY_CONFIG[category];
          const isActive = activeCategories.has(category);

          return (
            <Button
              key={category}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => toggleCategory(category)}
              className="rounded-full"
              style={
                isActive
                  ? { backgroundColor: config.color, borderColor: config.color }
                  : undefined
              }
            >
              {config.label}
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative ml-4 border-l-2 border-zinc-700 space-y-8 pb-4">
        {filteredEvents.map((event) => {
          const config = CATEGORY_CONFIG[event.category];

          return (
            <div key={event.id} className="relative pl-8">
              {/* Dot */}
              <div
                className="absolute -left-[9px] top-1.5 size-4 rounded-full border-2 border-zinc-900"
                style={{ backgroundColor: config.color }}
              />

              {/* Content */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <time className="text-xs text-muted-foreground">
                    {new Date(event.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  <Badge
                    variant={config.badgeVariant}
                    className={
                      config.badgeVariant === "outline"
                        ? "text-blue-400 border-blue-400/20"
                        : undefined
                    }
                  >
                    {config.label}
                  </Badge>
                </div>
                <h4 className="font-semibold text-foreground">{event.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {event.description}
                </p>
              </div>
            </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="pl-8 py-8 text-center">
            <p className="text-muted-foreground">
              No events match the selected filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
