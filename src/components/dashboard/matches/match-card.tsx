import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ContributorMatch } from "@/types/protection";

const statusVariant: Record<string, "success" | "warning" | "purple" | "secondary"> = {
  new: "purple",
  reviewed: "secondary",
  takedown_filed: "success",
  removed: "success",
  disputed: "warning",
  dismissed: "secondary",
};

export function MatchCard({ match }: { match: ContributorMatch }) {
  const confidencePercent = Math.round(match.similarity_score * 100);

  return (
    <Link href={`/dashboard/matches/${match.id}`}>
      <Card className="border-border/50 bg-card rounded-xl hover:border-primary/30 transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">
                  {match.platform || "Unknown Platform"}
                </span>
                {match.ai_generator && (
                  <span className="text-xs text-muted-foreground">
                    {match.ai_generator}
                  </span>
                )}
              </div>
              {match.page_title && (
                <p className="text-xs text-muted-foreground truncate">
                  {match.page_title}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(match.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-lg font-bold">{confidencePercent}%</p>
                <p className="text-[10px] text-muted-foreground">match</p>
              </div>
              <Badge
                variant={statusVariant[match.status] || "secondary"}
                className="capitalize text-[10px]"
              >
                {match.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
