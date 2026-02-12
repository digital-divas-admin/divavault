import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";

interface AiDetectionCalloutProps {
  isAiGenerated: boolean | null;
  aiDetectionScore: number | null;
  aiGenerator: string | null;
}

export function AiDetectionCallout({ isAiGenerated, aiDetectionScore, aiGenerator }: AiDetectionCalloutProps) {
  if (!isAiGenerated) return null;

  const confidencePercent = aiDetectionScore ? Math.round(aiDetectionScore * 100) : null;

  return (
    <Card className="border-l-4 border-l-yellow-500 bg-yellow-500/5 border-border/50 rounded-xl mb-6">
      <CardContent className="p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm">AI-Generated Content Detected</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {aiGenerator
              ? `Likely created with ${aiGenerator}`
              : "Content appears to be AI-generated"}
            {confidencePercent !== null && ` (${confidencePercent}%)`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
