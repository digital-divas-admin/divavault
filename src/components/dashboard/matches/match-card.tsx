import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPlatformConfig } from "@/lib/platform-icons";
import { timeAgo } from "@/lib/format";
import { StatusPipeline } from "@/components/dashboard/matches/status-pipeline";
import type { ContributorMatch } from "@/types/protection";

const statusVariant: Record<string, "success" | "warning" | "purple" | "secondary"> = {
  new: "purple",
  reviewed: "secondary",
  takedown_filed: "success",
  removed: "success",
  disputed: "warning",
  dismissed: "secondary",
};

function MiniConfidenceRing({ score }: { score: number }) {
  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - score * circumference;
  const percent = Math.round(score * 100);

  let strokeColor: string;
  if (score >= 0.85) strokeColor = "#EF4444";
  else if (score >= 0.60) strokeColor = "#F59E0B";
  else strokeColor = "#71717A";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(113,113,122,0.15)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold">{percent}%</span>
      </div>
    </div>
  );
}

export function MatchCard({ match }: { match: ContributorMatch }) {
  const platformConfig = getPlatformConfig(match.platform);
  const PlatformIcon = platformConfig.icon;
  const isNew = match.status === "new";

  return (
    <Link href={`/dashboard/matches/${match.id}`}>
      <Card
        className={`border-border/50 bg-card rounded-xl hover:border-primary/30 transition-colors ${
          isNew ? "match-new-pulse" : ""
        }`}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {/* Confidence ring */}
            <MiniConfidenceRing score={match.similarity_score} />

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <PlatformIcon
                    className="w-4 h-4 shrink-0"
                    style={{ color: platformConfig.color }}
                  />
                  <span className="font-medium text-sm truncate">
                    {platformConfig.label}
                  </span>
                  {match.is_ai_generated && (
                    <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                      AI
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={statusVariant[match.status] || "secondary"}
                    className="capitalize text-[10px]"
                  >
                    {match.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              {match.page_title && (
                <p className="text-xs text-muted-foreground truncate mb-1">
                  {match.page_title}
                </p>
              )}

              <div className="flex items-center justify-between">
                <StatusPipeline status={match.status} />
                <span className="text-[11px] text-muted-foreground/60">
                  {timeAgo(match.created_at)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
