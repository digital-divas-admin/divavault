import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { NewFooter } from "@/components/landing/new-footer";
import { ApiReference } from "@/components/developers/api-reference";

export const metadata: Metadata = {
  title: "Developer API Reference | Consented AI",
  description:
    "Integrate with the Consented Identity Registry. API reference, authentication guide, and consent specification for AI platforms.",
  openGraph: {
    title: "Developer API Reference | Consented AI",
    description:
      "Integrate with the Consented Identity Registry API to verify consent before using someone's likeness in AI.",
    type: "website",
  },
};

export default function DevelopersPage() {
  return (
    <>
      <Navbar variant="dark" />
      <main className="min-h-screen pt-16">
        {/* Hero Section */}
        <section className="pt-12 pb-8 px-4 sm:pt-20 sm:pb-12 sm:px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-4xl mx-auto relative">
            <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl text-foreground mb-5">
              Developer{" "}
              <span className="text-primary">API Reference</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Integrate with the Consented Identity Registry to verify consent
              before using someone&apos;s likeness in AI training or generation.
            </p>
          </div>
        </section>

        {/* API Reference */}
        <section className="pb-16 sm:pb-24 px-4 sm:px-6">
          <ApiReference />
        </section>
      </main>
      <NewFooter />
    </>
  );
}
