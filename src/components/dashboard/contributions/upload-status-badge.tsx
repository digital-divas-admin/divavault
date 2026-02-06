import { Badge } from "@/components/ui/badge";
import type { UploadStatus } from "@/types/dashboard";

const statusConfig: Record<
  UploadStatus,
  { label: string; className: string }
> = {
  processing: {
    label: "Processing",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  active: {
    label: "Active",
    className: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  pending_review: {
    label: "In Review",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  flagged: {
    label: "Flagged",
    className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  removed: {
    label: "Removed",
    className: "bg-muted text-muted-foreground border-border/50",
  },
};

export function UploadStatusBadge({ status }: { status: UploadStatus }) {
  const config = statusConfig[status] || statusConfig.processing;
  return (
    <Badge className={`text-[10px] px-1.5 py-0 h-4 ${config.className}`}>
      {config.label}
    </Badge>
  );
}
