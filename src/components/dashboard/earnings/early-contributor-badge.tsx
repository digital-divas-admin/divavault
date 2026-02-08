import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";

interface EarlyContributorBadgeProps {
  joinDate: string;
}

export function EarlyContributorBadge({
  joinDate,
}: EarlyContributorBadgeProps) {
  return (
    <Card className="border-primary/20 bg-primary/5 rounded-xl">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="rounded-full bg-primary/10 p-3 shrink-0">
          <Award className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold">Founding Contributor</h3>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 h-4">
              Early Access
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            You joined on{" "}
            {new Date(joinDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            . Founding contributors receive priority access to earnings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
