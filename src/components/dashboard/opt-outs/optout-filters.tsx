"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OptOutFiltersProps {
  totalCount: number;
}

export function OptOutFilters({ totalCount }: OptOutFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";
  const currentMethod = searchParams.get("method") || "all";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/dashboard/opt-outs?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={currentStatus}
        onValueChange={(v) => updateParam("status", v)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="not_started">Not Started</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="confirmed">Confirmed</SelectItem>
          <SelectItem value="denied">Denied</SelectItem>
          <SelectItem value="unresponsive">Unresponsive</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={currentMethod}
        onValueChange={(v) => updateParam("method", v)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Methods</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="web_form">Web Form</SelectItem>
          <SelectItem value="account_settings">Account Settings</SelectItem>
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground ml-auto">
        Showing {totalCount} {totalCount === 1 ? "company" : "companies"}
      </span>
    </div>
  );
}
