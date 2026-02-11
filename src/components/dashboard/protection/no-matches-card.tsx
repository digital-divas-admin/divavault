import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function NoMatchesCard() {
  return (
    <Card className="border-accent/20 bg-accent/5 rounded-2xl">
      <CardContent className="p-6 text-center">
        <ShieldCheck className="w-10 h-10 text-accent mx-auto mb-3" />
        <h3 className="font-semibold mb-1">All Clear</h3>
        <p className="text-sm text-muted-foreground">
          No unauthorized use of your likeness has been detected. We&apos;re
          continuously monitoring and will alert you if anything comes up.
        </p>
      </CardContent>
    </Card>
  );
}
