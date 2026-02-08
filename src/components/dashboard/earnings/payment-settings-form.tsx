"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, Wallet } from "lucide-react";

interface PaymentSettingsFormProps {
  paypalEmail: string | null;
}

export function PaymentSettingsForm({
  paypalEmail: initialEmail,
}: PaymentSettingsFormProps) {
  const [paypalEmail, setPaypalEmail] = useState(initialEmail || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const res = await fetch("/api/dashboard/payment-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paypal_email: paypalEmail.trim() || null,
      }),
    });

    setSaving(false);

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
  };

  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Payment Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">PayPal Email</Label>
          <Input
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="your@paypal-email.com"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Earnings will be sent to this PayPal account.
          </p>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1" /> Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            "Save Payment Info"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
