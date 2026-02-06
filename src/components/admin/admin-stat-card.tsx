import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface AdminStatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  iconClassName?: string;
  iconBgClassName?: string;
}

export function AdminStatCard({
  icon: Icon,
  value,
  label,
  iconClassName = "text-neon",
  iconBgClassName = "bg-neon/10",
}: AdminStatCardProps) {
  return (
    <Card className="bg-card/50 border-border/30">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-full p-2 ${iconBgClassName}`}>
          <Icon className={`h-4 w-4 ${iconClassName}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
