import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

export function TierGate({
  feature,
  children,
  canAccess,
}: {
  feature: string;
  children: React.ReactNode;
  canAccess: boolean;
}) {
  if (canAccess) return <>{children}</>;

  return (
    <Card className="border-border/50 bg-secondary/50 rounded-xl relative overflow-hidden">
      <CardContent className="p-6 text-center">
        <Lock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="font-semibold text-sm mb-1">
          Upgrade to access {feature}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          This feature is available on the Protected or Premium plan.
        </p>
        <Button asChild size="sm" className="rounded-full">
          <Link href="/dashboard/account">Upgrade Plan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
