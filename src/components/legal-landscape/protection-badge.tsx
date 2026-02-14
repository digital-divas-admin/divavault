import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Shield, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProtectionLevel } from "@/data/legal-landscape/types";

const config: Record<
  ProtectionLevel,
  {
    variant: "success" | "warning" | "outline" | "destructive";
    label: string;
    icon: typeof ShieldCheck;
    className?: string;
  }
> = {
  strong: {
    variant: "success",
    label: "Strong Protection",
    icon: ShieldCheck,
  },
  moderate: {
    variant: "warning",
    label: "Moderate Protection",
    icon: Shield,
  },
  basic: {
    variant: "outline",
    label: "Basic Protection",
    icon: Shield,
    className: "text-blue-400 border-blue-400/20",
  },
  none: {
    variant: "destructive",
    label: "No Protection",
    icon: ShieldOff,
  },
};

export function ProtectionBadge({
  level,
  className,
}: {
  level: ProtectionLevel;
  className?: string;
}) {
  const { variant, label, icon: Icon, className: variantClassName } =
    config[level];

  return (
    <Badge variant={variant} className={cn(variantClassName, className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
