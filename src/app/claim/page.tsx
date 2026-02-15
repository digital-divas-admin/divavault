"use client";

import { useState } from "react";
import { SelfieCapture } from "@/components/claim/selfie-capture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Mail } from "lucide-react";
import Link from "next/link";

export default function ClaimPage() {
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [email, setEmail] = useState("");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultCid, setResultCid] = useState<string | null>(null);

  const handleCapture = (blob: Blob) => {
    setSelfieBlob(blob);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selfieBlob || !consented) return;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("selfie", selfieBlob, "selfie.jpg");
      if (email) formData.append("email", email);

      const res = await fetch("/api/registry/claim", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setResultCid(data.cid);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (resultCid) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center text-center gap-6">
          <ShieldCheck className="w-16 h-16 text-primary" />
          <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
            Your Face is Registered
          </h1>
          <p className="text-muted-foreground max-w-md">
            Your selfie has been registered. We&apos;ll scan AI platforms for
            unauthorized use of your likeness.
          </p>

          <div className="w-full bg-card border border-border px-4 py-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Your Registry CID</p>
            <p className="font-mono text-sm text-foreground break-all">{resultCid}</p>
          </div>

          {email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span>We&apos;ll notify you at {email} if we find any matches.</span>
            </div>
          )}

          <div className="pt-4 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Want full protection with automated DMCA takedowns?
            </p>
            <Button asChild>
              <Link href="/signup">Get Full Protection</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl text-foreground mb-3">
          Claim Your Face
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Take a selfie to register your likeness on the Consented Identity
          Registry. Free, no account needed.
        </p>
      </div>

      {!selfieBlob && <SelfieCapture onCapture={handleCapture} />}

      {selfieBlob && (
        <div className="flex flex-col gap-6 mt-6">
          <div>
            <Label htmlFor="email" className="mb-2">
              <Mail className="w-4 h-4" />
              Get notified if we find your likeness being used
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={consented}
              onCheckedChange={(checked) => setConsented(checked === true)}
            />
            <Label htmlFor="consent" className="text-sm text-muted-foreground leading-snug cursor-pointer">
              I consent to my selfie being processed to create a facial
              signature for likeness protection. My photo will not be shared or
              used for AI training.
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!consented || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              "Register My Likeness"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
