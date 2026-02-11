import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  running: { label: "Running", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  completed: { label: "Completed", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  interrupted: { label: "Interrupted", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

export function ScanStatusBadge({ status }: { status: string }) {
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}
