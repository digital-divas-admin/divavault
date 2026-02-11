"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, Loader2 } from "lucide-react";

interface QRHandoffProps {
  onContinueOnDesktop: () => void;
  variant?: "verification" | "capture";
  step?: number;
}

const COPY = {
  verification: {
    title: "Verify on Your Phone",
    description: "Identity verification works best on mobile. Scan this QR code with your phone to continue there",
  },
  capture: {
    title: "Capture on Your Phone",
    description: "Photo capture requires a camera. Scan this QR code to continue on your phone",
  },
};

export function QRHandoff({ onContinueOnDesktop, variant = "verification", step = 1 }: QRHandoffProps) {
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function generateHandoff() {
      try {
        const res = await fetch("/api/onboarding/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        });
        if (res.ok) {
          const data = await res.json();
          setHandoffUrl(data.url);
        }
      } catch {
        // Fall through to desktop flow
      } finally {
        setLoading(false);
      }
    }

    generateHandoff();
  }, [step]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <Card className="border-border/50 bg-card rounded-2xl">
      <CardContent className="p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>
        <h3 className="font-semibold text-sm mb-2">
          {COPY[variant].title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {COPY[variant].description}, or{" "}
          <button
            onClick={onContinueOnDesktop}
            className="text-primary underline underline-offset-2"
          >
            continue on desktop
          </button>
          .
        </p>

        {handoffUrl && (
          <div className="inline-block p-4 bg-white rounded-xl border border-border/30">
            <QRCodeSVG
              value={handoffUrl}
              size={180}
              bgColor="#FFFFFF"
              fgColor="#1C2333"
              level="M"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
