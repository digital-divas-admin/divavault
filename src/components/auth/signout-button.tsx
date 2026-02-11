"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      localStorage.removeItem("madeofus-onboarding");
      router.push("/?signed_out=true");
    } catch {
      // Fallback: redirect even if signOut errors
      localStorage.removeItem("madeofus-onboarding");
      router.push("/?signed_out=true");
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={loading}
      className="w-full justify-start text-muted-foreground hover:text-destructive"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4 mr-2" />
      )}
      Sign Out
    </Button>
  );
}
