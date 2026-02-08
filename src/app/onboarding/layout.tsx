import Link from "next/link";
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
        <Link
          href="/"
          className="font-[family-name:var(--font-heading)] text-2xl italic"
        >
          <span className="text-primary">made of </span>
          <span className="text-secondary">us</span>
        </Link>
        <AppSwitcher />
      </header>
      <main className="px-4 py-10">
        <OnboardingErrorBoundary>{children}</OnboardingErrorBoundary>
      </main>
    </div>
  );
}
