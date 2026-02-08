import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RequestCategory, RequestSortBy } from "@/types/marketplace";

interface MarketplaceState {
  // Browse filters
  search: string;
  category: RequestCategory | "all";
  sortBy: RequestSortBy;

  // Actions
  setSearch: (search: string) => void;
  setCategory: (category: RequestCategory | "all") => void;
  setSortBy: (sortBy: RequestSortBy) => void;
  resetFilters: () => void;
}

const defaultFilters = {
  search: "",
  category: "all" as const,
  sortBy: "newest" as const,
};

export const useMarketplaceStore = create<MarketplaceState>()(
  persist(
    (set) => ({
      ...defaultFilters,

      setSearch: (search) => set({ search }),
      setCategory: (category) => set({ category }),
      setSortBy: (sortBy) => set({ sortBy }),
      resetFilters: () => set(defaultFilters),
    }),
    {
      name: "madeofus-marketplace",
    }
  )
);
