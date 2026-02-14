import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BillStatus } from "@/data/legal-landscape/types";

const config: Record<
  BillStatus,
  { variant: "success" | "purple" | "secondary" | "destructive"; label: string }
> = {
  signed: { variant: "success", label: "Signed Into Law" },
  passed: { variant: "success", label: "Passed" },
  committee: { variant: "purple", label: "In Committee" },
  introduced: { variant: "secondary", label: "Introduced" },
  expired: { variant: "destructive", label: "Expired" },
};

export function BillStatusBadge({
  status,
  className,
}: {
  status: BillStatus;
  className?: string;
}) {
  const { variant, label } = config[status];

  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  );
}
