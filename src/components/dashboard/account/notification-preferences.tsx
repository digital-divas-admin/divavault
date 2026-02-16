"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { NotificationPreferences as NotificationPrefsType } from "@/types/dashboard";

interface NotificationPreferencesProps {
  preferences: NotificationPrefsType;
}

export function NotificationPreferences({
  preferences: initial,
}: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState(initial);

  const handleToggle = async (
    key: keyof Omit<NotificationPrefsType, "contributor_id" | "updated_at">,
    value: boolean
  ) => {
    if (key === "email_security_alerts") return; // Always on

    const updated = { ...prefs, [key]: value };
    setPrefs(updated);

    await fetch("/api/dashboard/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifications: {
          [key]: value,
        },
      }),
    });
  };

  const items = [
    {
      key: "email_match_alerts" as const,
      label: "Match Alerts",
      description: "Get notified when your likeness is found on AI platforms",
    },
    {
      key: "email_scan_updates" as const,
      label: "Scan Updates",
      description: "Status updates when scans complete",
    },
    {
      key: "email_takedown_updates" as const,
      label: "Takedown Updates",
      description: "Status changes on DMCA takedown requests",
    },
    {
      key: "email_optout_updates" as const,
      label: "Opt-Out Updates",
      description: "Updates on your AI data opt-out requests",
    },
    {
      key: "email_photo_status" as const,
      label: "Photo Status Changes",
      description: "When photos are processed or flagged",
    },
    {
      key: "email_platform_updates" as const,
      label: "Platform Updates",
      description: "New features and important announcements",
    },
    {
      key: "email_security_alerts" as const,
      label: "Security Alerts",
      description: "Account security notifications",
      alwaysOn: true,
    },
  ];

  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Email Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <Label className="text-sm">{item.label}</Label>
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
            <Switch
              checked={prefs[item.key] ?? true}
              onCheckedChange={(v) => handleToggle(item.key, v)}
              disabled={item.alwaysOn}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
