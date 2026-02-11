import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  reviewed: { label: "Reviewed", className: "bg-green-500/10 text-green-600 border-green-500/20" },
};

export function MatchStatusBadge({ status }: { status: string }) {
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}
