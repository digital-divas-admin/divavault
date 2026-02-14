"use client";

import { useState, useMemo } from "react";
// @ts-expect-error -- react-simple-maps has no type declarations
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { statesByFips } from "@/data/legal-landscape/states";
import type { ProtectionLevel, StateData } from "@/data/legal-landscape/types";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const PROTECTION_COLORS: Record<ProtectionLevel, string> = {
  strong: "#22C55E",
  moderate: "#F59E0B",
  basic: "#3B82F6",
  none: "#EF4444",
};

const PROTECTION_HOVER_COLORS: Record<ProtectionLevel, string> = {
  strong: "#4ADE80",
  moderate: "#FBBF24",
  basic: "#60A5FA",
  none: "#F87171",
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
    <div className="relative bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
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
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
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

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        {LEGEND_ITEMS.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: PROTECTION_COLORS[level] }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
