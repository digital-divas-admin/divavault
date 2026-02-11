import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  medium: { label: "Medium", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  low: { label: "Low", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  const c = config[confidence] || { label: confidence, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}
