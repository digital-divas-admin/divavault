import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  green: { label: "Verified", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  red: { label: "Rejected", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  retry: { label: "Retry", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

interface VerificationStatusBadgeProps {
  status: string;
}

export function VerificationStatusBadge({ status }: VerificationStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
