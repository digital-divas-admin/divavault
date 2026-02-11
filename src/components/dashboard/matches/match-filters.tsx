"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MatchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";

  function onStatusChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    params.delete("page");
    router.push(`/dashboard/matches?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <Select value={currentStatus} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Matches</SelectItem>
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="reviewed">Reviewed</SelectItem>
          <SelectItem value="takedown_filed">Takedown Filed</SelectItem>
          <SelectItem value="removed">Removed</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
