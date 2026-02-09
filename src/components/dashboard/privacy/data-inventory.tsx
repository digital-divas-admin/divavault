import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  ImageIcon,
  Shield,
  FileText,
  Activity,
} from "lucide-react";

interface DataInventoryProps {
  photoCount: number;
  verified: boolean;
  consentGiven: boolean;
  activityCount: number;
}

export function DataInventory({
  photoCount,
  verified,
  consentGiven,
  activityCount,
}: DataInventoryProps) {
  const items = [
    {
      icon: User,
      label: "Profile Information",
      detail: "Name, email, display name",
    },
    {
      icon: ImageIcon,
      label: "Photos",
      detail: `${photoCount} photo${photoCount !== 1 ? "s" : ""} in encrypted storage`,
    },
    {
      icon: Shield,
      label: "Verification Status",
      detail: verified ? "Identity verified via Sumsub" : "Verification pending",
    },
    {
      icon: FileText,
      label: "Consent Record",
      detail: consentGiven ? "Consent on file" : "No consent recorded",
    },
    {
      icon: Activity,
      label: "Activity Log",
      detail: `${activityCount} logged action${activityCount !== 1 ? "s" : ""}`,
    },
  ];

  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Your Data Inventory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <div className="rounded-lg bg-muted/50 p-2 shrink-0">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-secondary">
            Your ID documents are processed by Sumsub and never stored by us.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
