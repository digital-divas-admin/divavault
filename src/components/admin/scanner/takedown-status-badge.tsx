import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  submitted: { label: "Submitted", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  resolved: { label: "Resolved", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export function TakedownStatusBadge({ status }: { status: string }) {
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}
