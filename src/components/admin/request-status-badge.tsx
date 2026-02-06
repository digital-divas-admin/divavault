import { Badge } from "@/components/ui/badge";
import type { RequestStatus } from "@/types/marketplace";

const statusConfig: Record<RequestStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-muted/50 text-muted-foreground border-border/30",
  },
  pending_review: {
    label: "Pending Review",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  published: {
    label: "Published",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  paused: {
    label: "Paused",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  closed: {
    label: "Closed",
    className: "bg-muted/50 text-muted-foreground border-border/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

interface RequestStatusBadgeProps {
  status: RequestStatus;
}

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}
