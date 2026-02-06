import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Lock, ShieldCheck } from "lucide-react";

interface SecuritySectionProps {
  lastLoginAt: string | null;
}

export function SecuritySection({ lastLoginAt }: SecuritySectionProps) {
  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Last Login</p>
              <p className="text-xs text-muted-foreground">
                {lastLoginAt
                  ? new Date(lastLoginAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Not recorded"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                Use the forgot password flow to change
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">
                Additional account protection
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Coming Soon
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
