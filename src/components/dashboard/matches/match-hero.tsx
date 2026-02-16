import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPlatformConfig } from "@/lib/platform-icons";
import { formatDate } from "@/lib/format";

const statusVariant: Record<string, "success" | "warning" | "primary" | "secondary"> = {
  new: "primary",
  reviewed: "secondary",
  takedown_filed: "success",
  removed: "success",
  disputed: "warning",
  dismissed: "secondary",
};

interface MatchHeroProps {
  similarityScore: number;
  confidenceTier: string;
  platform: string | null;
  createdAt: string;
  status: string;
}

function getConfidenceColor(score: number): { stroke: string; glow: string } {
  if (score >= 0.85) return { stroke: "#EF4444", glow: "rgba(239,68,68,0.3)" };
  if (score >= 0.60) return { stroke: "#F59E0B", glow: "rgba(245,158,11,0.3)" };
  return { stroke: "#71717A", glow: "rgba(113,113,122,0.2)" };
}

export function MatchHero({ similarityScore, confidenceTier, platform, createdAt, status }: MatchHeroProps) {
  const percent = Math.round(similarityScore * 100);
  const { stroke, glow } = getConfidenceColor(similarityScore);
  const platformConfig = getPlatformConfig(platform);
  const PlatformIcon = platformConfig.icon;

  // SVG ring math (100px diameter)
  const size = 100;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (similarityScore * circumference);

  return (
    <Card className="border-border/50 bg-card rounded-xl mb-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-6">
          {/* Confidence Ring */}
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
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{percent}%</span>
              <span className="text-[10px] text-muted-foreground capitalize">{confidenceTier}</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <PlatformIcon className="w-5 h-5" style={{ color: platformConfig.color }} />
              <span className="font-medium text-lg">{platformConfig.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Detected {formatDate(createdAt)}</span>
              <Badge
                variant={statusVariant[status] || "secondary"}
                className="capitalize text-[10px]"
              >
                {status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
