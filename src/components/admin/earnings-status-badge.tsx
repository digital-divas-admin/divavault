import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  processing: { label: "Processing", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  paid: { label: "Paid", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  held: { label: "Held", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

interface EarningsStatusBadgeProps {
  status: string;
}

export function EarningsStatusBadge({ status }: EarningsStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
