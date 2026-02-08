"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface ClientInfo {
  name: string;
  logoUrl: string;
}

export default function AuthorizePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const scope = searchParams.get("scope") || "profile";
  const state = searchParams.get("state") || "";

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!clientId || !redirectUri) {
        setError("Missing required parameters");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/auth/authorize/validate?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Invalid authorization request");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setClientInfo(data.client);
      } catch {
        setError("Failed to validate authorization request");
      }
      setLoading(false);
    }
    validate();
  }, [clientId, redirectUri]);

  const handleAllow = useCallback(async () => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.href)}`);
        return;
      }

      const res = await fetch("/api/auth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Authorization failed");
        setSubmitting(false);
        return;
      }

      const { redirect_url } = await res.json();
      window.location.href = redirect_url;
    } catch {
      setError("Something went wrong");
      setSubmitting(false);
    }
  }, [clientId, redirectUri, scope, state, router]);

  const handleDeny = useCallback(() => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }, [redirectUri, state]);

  const scopes = scope.split(",").map((s) => s.trim());

  const scopeLabels: Record<string, string> = {
    profile: "View your basic profile information",
    "contributors:read": "View your contributor profile and attributes",
    "consent:read": "View your consent preferences",
    "photos:read": "Access your uploaded photos",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Validating...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-destructive">
            Authorization Error
          </h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Authorize {clientInfo?.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{clientInfo?.name}</span>{" "}
            wants to access your Made Of Us account
          </p>
        </div>

        <div className="rounded-lg border border-border/30 bg-card p-4 space-y-3">
          <p className="text-sm font-medium">This will allow {clientInfo?.name} to:</p>
          <ul className="space-y-2">
            {scopes.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-0.5">&#10003;</span>
                <span>{scopeLabels[s] || s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDeny}
            disabled={submitting}
          >
            Deny
          </Button>
          <Button
            className="flex-1"
            onClick={handleAllow}
            disabled={submitting}
          >
            {submitting ? "Authorizing..." : "Allow"}
          </Button>
        </div>
      </div>
    </div>
  );
}
