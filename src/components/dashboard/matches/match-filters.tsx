"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlatformConfig } from "@/lib/platform-icons";

interface MatchFiltersProps {
  platforms: string[];
  totalCount: number;
}

export function MatchFilters({ platforms, totalCount }: MatchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";
  const currentConfidence = searchParams.get("confidence") || "all";
  const currentPlatform = searchParams.get("platform") || "all";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/dashboard/matches?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={currentStatus} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="reviewed">Reviewed</SelectItem>
          <SelectItem value="takedown_filed">Takedown Filed</SelectItem>
          <SelectItem value="removed">Removed</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={currentConfidence} onValueChange={(v) => updateParam("confidence", v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Confidence" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Confidence</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {platforms.length > 0 && (
        <Select value={currentPlatform} onValueChange={(v) => updateParam("platform", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p}>
                {getPlatformConfig(p).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <span className="text-xs text-muted-foreground ml-auto">
        Showing {totalCount} {totalCount === 1 ? "match" : "matches"}
      </span>
    </div>
  );
}
