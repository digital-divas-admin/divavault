import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  muted?: boolean;
}

export function StatCard({ icon: Icon, label, value, subtitle, muted }: StatCardProps) {
  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p
          className={`text-2xl font-bold ${muted ? "text-muted-foreground/50" : "text-primary"}`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
