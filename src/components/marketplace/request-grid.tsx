"use client";

import { useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import { RequestCard } from "./request-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useMarketplaceStore } from "@/stores/marketplace-store";
import type { BountyRequestWithMeta } from "@/types/marketplace";

interface RequestGridProps {
  requests: BountyRequestWithMeta[];
}

export function RequestGrid({ requests }: RequestGridProps) {
  const { search, category, sortBy } = useMarketplaceStore();

  const filtered = useMemo(() => {
    let result = [...requests];

    // Client-side search filter (server also filters, but this handles Zustand state changes)
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(lower) ||
          r.description.toLowerCase().includes(lower)
      );
    }

    if (category !== "all") {
      result = result.filter((r) => r.category === category);
    }

    // Sort
    switch (sortBy) {
      case "deadline":
        result.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
        break;
      case "highest_pay":
        result.sort((a, b) => b.pay_amount_cents - a.pay_amount_cents);
        break;
      default:
        result.sort(
          (a, b) =>
            new Date(b.published_at || b.created_at).getTime() -
            new Date(a.published_at || a.created_at).getTime()
        );
    }

    return result;
  }, [requests, search, category, sortBy]);

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        heading="No requests yet"
        message="We're preparing the first batch of opportunities. Check back soon — we'll notify you when something drops."
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        heading="Nothing matches your filters"
        message="Try broadening your search or clearing filters to see all open requests."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filtered.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}
