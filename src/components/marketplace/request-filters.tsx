"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMarketplaceStore } from "@/stores/marketplace-store";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "portrait", label: "Portrait" },
  { value: "full_body", label: "Full Body" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "fashion", label: "Fashion" },
  { value: "fitness", label: "Fitness" },
  { value: "artistic", label: "Artistic" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "themed", label: "Themed" },
  { value: "other", label: "Other" },
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "deadline", label: "Deadline" },
  { value: "highest_pay", label: "Highest Pay" },
];

const trackOptions = [
  { value: "all", label: "All Tracks" },
  { value: "sfw", label: "SFW" },
  { value: "nsfw", label: "NSFW" },
];

export function RequestFilters() {
  const { search, category, sortBy, trackType, setSearch, setCategory, setSortBy, setTrackType } =
    useMarketplaceStore();

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search requests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/50 border-border/30"
        />
      </div>

      {/* Category */}
      <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
        <SelectTrigger className="w-full sm:w-[160px] bg-card/50 border-border/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Track */}
      <Select value={trackType} onValueChange={(v) => setTrackType(v as typeof trackType)}>
        <SelectTrigger className="w-full sm:w-[130px] bg-card/50 border-border/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {trackOptions.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
        <SelectTrigger className="w-full sm:w-[140px] bg-card/50 border-border/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
