import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { OnboardingErrorBoundary } from "@/components/onboarding/error-boundary";
import { AppSwitcher } from "@/components/app-switcher";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground text-lg">consented<span className="text-primary">ai</span></span>
        </Link>
        <AppSwitcher />
      </header>
      <main className="px-4 py-10">
        <OnboardingErrorBoundary>{children}</OnboardingErrorBoundary>
      </main>
    </div>
  );
}
