"use client";

import { useState, useMemo } from "react";
// @ts-expect-error -- react-simple-maps has no type declarations
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { statesByFips } from "@/data/legal-landscape/states";
import type { ProtectionLevel, StateData } from "@/data/legal-landscape/types";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const PROTECTION_COLORS: Record<ProtectionLevel, string> = {
  strong: "#16794A",
  moderate: "#A37218",
  basic: "#2563A8",
  none: "#9F3030",
};

const PROTECTION_HOVER_COLORS: Record<ProtectionLevel, string> = {
  strong: "#1E9D5E",
  moderate: "#C8901F",
  basic: "#3478CC",
  none: "#C04040",
};

const PROTECTION_LABELS: Record<ProtectionLevel, string> = {
  strong: "Strong Protection",
  moderate: "Moderate Protection",
  basic: "Basic Protection",
  none: "No Protection",
};

const LEGEND_ITEMS: { level: ProtectionLevel; label: string }[] = [
  { level: "strong", label: "Strong" },
  { level: "moderate", label: "Moderate" },
  { level: "basic", label: "Basic" },
  { level: "none", label: "No Protection" },
];

interface USMapChartProps {
  onStateSelect: (abbreviation: string) => void;
  selectedState: string | null;
}

export default function USMapChart({
  onStateSelect,
  selectedState,
}: USMapChartProps) {
  const [hoveredState, setHoveredState] = useState<{
    name: string;
    level: ProtectionLevel;
  } | null>(null);

  const selectedFips = useMemo(() => {
    if (!selectedState) return null;
    const entry = Object.entries(statesByFips as Record<string, StateData>).find(
      ([, data]) => data.abbreviation === selectedState
    );
    return entry ? entry[0] : null;
  }, [selectedState]);

  return (
    <div className="relative bg-card/50 rounded-xl border border-border/50 p-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-5 sm:gap-8 mb-3 pb-3 border-b border-border/50">
        {LEGEND_ITEMS.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-2">
            <span
              className="size-3 rounded-sm"
              style={{ backgroundColor: PROTECTION_COLORS[level] }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1000 }}
        width={800}
        height={500}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: Array<{ id: string; rsmKey: string; [key: string]: unknown }> }) =>
            geographies.map((geo: { id: string; rsmKey: string; [key: string]: unknown }) => {
              const fips = geo.id as string;
              const stateData = (statesByFips as Record<string, StateData>)[fips];
              if (!stateData) return null;

              const level: ProtectionLevel = stateData.protectionLevel;
              const isSelected = fips === selectedFips;
              const fillColor = PROTECTION_COLORS[level];

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => onStateSelect(stateData.abbreviation)}
                  onMouseEnter={() =>
                    setHoveredState({
                      name: stateData.name,
                      level,
                    })
                  }
                  onMouseLeave={() => setHoveredState(null)}
                  style={{
                    default: {
                      fill: fillColor,
                      stroke: isSelected ? "#FAFAFA" : "#18181B",
                      strokeWidth: isSelected ? 2 : 0.5,
                      cursor: "pointer",
                      outline: "none",
                    },
                    hover: {
                      fill: PROTECTION_HOVER_COLORS[level],
                      stroke: isSelected ? "#FAFAFA" : "#A1A1AA",
                      strokeWidth: isSelected ? 2 : 1,
                      cursor: "pointer",
                      outline: "none",
                    },
                    pressed: {
                      fill: fillColor,
                      stroke: "#FAFAFA",
                      strokeWidth: 2,
                      cursor: "pointer",
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Tooltip bar */}
      {hoveredState && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-card border border-border/50 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg pointer-events-none">
          <span
            className="size-3 rounded-full"
            style={{
              backgroundColor: PROTECTION_COLORS[hoveredState.level],
            }}
          />
          <span className="text-sm font-medium text-foreground">
            {hoveredState.name}
          </span>
          <span className="text-sm text-muted-foreground">
            {PROTECTION_LABELS[hoveredState.level]}
          </span>
        </div>
      )}

    </div>
  );
}
