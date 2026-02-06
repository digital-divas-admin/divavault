import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram } from "lucide-react";

interface ConnectedAccountsProps {
  instagramUsername: string | null;
}

export function ConnectedAccounts({
  instagramUsername,
}: ConnectedAccountsProps) {
  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Connected Accounts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted/50 p-2">
              <Instagram className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Instagram</p>
              <p className="text-xs text-muted-foreground">
                {instagramUsername
                  ? `@${instagramUsername}`
                  : "Not connected"}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] ${instagramUsername ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}`}
          >
            {instagramUsername ? "Connected" : "Not Connected"}
          </Badge>
        </div>
        {instagramUsername && (
          <p className="text-[11px] text-muted-foreground/60 mt-3 pt-3 border-t border-border/30">
            Disconnecting doesn&apos;t remove already-contributed photos.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
