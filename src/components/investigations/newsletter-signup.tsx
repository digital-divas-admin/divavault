"use client";

import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type State = "idle" | "loading" | "success" | "error";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error || "Something went wrong");
        return;
      }

      setState("success");
    } catch {
      setState("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className="newsletter-signup bg-card border border-border rounded-xl p-6 sm:p-8 text-center no-print">
        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
        <p className="text-foreground font-semibold">You&apos;re subscribed!</p>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll notify you when we publish new investigations.
        </p>
      </div>
    );
  }

  return (
    <div className="newsletter-signup bg-card border border-border rounded-xl p-6 sm:p-8 no-print">
      <h3 className="font-[family-name:var(--font-heading)] text-xl text-foreground mb-1">
        Get Investigation Updates
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Be the first to know when we publish new deepfake investigations.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-3 flex-col sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 h-10"
        />
        <Button
          type="submit"
          disabled={state === "loading"}
          className="h-10 px-5"
        >
          {state === "loading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Subscribing...
            </>
          ) : (
            "Subscribe"
          )}
        </Button>
      </form>

      {state === "error" && (
        <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
