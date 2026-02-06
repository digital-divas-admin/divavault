import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus } from "@/types/marketplace";

const statusConfig: Record<
  SubmissionStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-muted/50 text-muted-foreground border-border/30",
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  in_review: {
    label: "In Review",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  accepted: {
    label: "Accepted",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  revision_requested: {
    label: "Needs Revision",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-muted/50 text-muted-foreground border-border/30",
  },
};

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
}

export function SubmissionStatusBadge({ status }: SubmissionStatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}
