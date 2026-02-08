"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function SignoutCleanup() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("signed_out") === "true") {
      // Clear onboarding data from localStorage
      localStorage.removeItem("madeofus-onboarding");
    }
  }, [searchParams]);

  return null;
}
