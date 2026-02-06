import { Badge } from "@/components/ui/badge";
import type { PayType } from "@/types/marketplace";

interface BountyBadgeProps {
  payAmountCents: number;
  payType: PayType;
  className?: string;
}

export function BountyBadge({ payAmountCents, payType, className }: BountyBadgeProps) {
  const dollars = (payAmountCents / 100).toFixed(payAmountCents % 100 === 0 ? 0 : 2);
  const label = payType === "per_image" ? "image" : "set";

  return (
    <Badge
      className={`bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20 ${className || ""}`}
    >
      ${dollars}/{label}
    </Badge>
  );
}
