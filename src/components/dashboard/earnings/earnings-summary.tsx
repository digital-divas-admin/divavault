import { Card, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export function EarningsSummary() {
  return (
    <Card className="border-secondary/20 bg-secondary/5 rounded-2xl">
      <CardContent className="p-6 sm:p-8 text-center">
        <div className="rounded-full bg-secondary/10 p-3 w-fit mx-auto mb-4">
          <DollarSign className="h-8 w-8 text-secondary" />
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold mb-2">
          Earnings Coming Soon
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          We&apos;re building the compensation system right now. Early
          contributors like you will be first in line when it launches.
        </p>
      </CardContent>
    </Card>
  );
}
