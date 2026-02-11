import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ContributorMatch } from "@/types/protection";

const statusVariant: Record<string, "success" | "warning" | "purple" | "secondary"> = {
  new: "purple",
  reviewed: "secondary",
  takedown_filed: "success",
  removed: "success",
  disputed: "warning",
  dismissed: "secondary",
};

export function RecentMatchesCard({
  matches,
}: {
  matches: ContributorMatch[];
}) {
  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <Link
          key={match.id}
          href={`/dashboard/matches/${match.id}`}
          className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium truncate">
              {match.platform || "Unknown platform"}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-muted-foreground">
              {Math.round(match.similarity_score * 100)}%
            </span>
            <Badge
              variant={statusVariant[match.status] || "secondary"}
              className="text-[10px] capitalize"
            >
              {match.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}
