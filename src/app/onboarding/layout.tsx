import Link from "next/link";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-grid">
      <header className="border-b border-border/30 px-6 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-heading)] text-lg font-bold"
        >
          <span className="text-neon">diva</span>vault
        </Link>
      </header>
      <main className="px-4 py-10">{children}</main>
    </div>
  );
}
