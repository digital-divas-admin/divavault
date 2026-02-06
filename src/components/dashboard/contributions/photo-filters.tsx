"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PhotoFiltersProps {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  counts: Record<string, number>;
}

export function PhotoFilters({
  currentFilter,
  onFilterChange,
  counts,
}: PhotoFiltersProps) {
  return (
    <Tabs value={currentFilter} onValueChange={onFilterChange}>
      <TabsList className="bg-muted/30">
        <TabsTrigger value="all" className="text-xs">
          All ({counts.all || 0})
        </TabsTrigger>
        <TabsTrigger value="active" className="text-xs">
          Active ({counts.active || 0})
        </TabsTrigger>
        <TabsTrigger value="processing" className="text-xs">
          Processing ({counts.processing || 0})
        </TabsTrigger>
        <TabsTrigger value="removed" className="text-xs">
          Removed ({counts.removed || 0})
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
