"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface ProfileFormProps {
  fullName: string;
  email: string;
  displayName: string | null;
  memberSince: string;
}

export function ProfileForm({
  fullName,
  email,
  displayName: initialDisplayName,
  memberSince,
}: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/dashboard/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName || null }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Full Name</Label>
          <Input value={fullName} disabled className="mt-1 opacity-60" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input value={email} disabled className="mt-1 opacity-60" />
        </div>
        <div>
          <Label className="text-xs">Display Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Choose a display name"
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-4">
          <div>
            <Label className="text-xs">Track</Label>
            <div className="mt-1">
              <Badge variant="secondary">
                Lifestyle (SFW)
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-xs">Member Since</Label>
            <p className="text-sm mt-1">
              {new Date(memberSince).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1" /> Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
