import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { NewFooter } from "@/components/landing/new-footer";
import { LegalLandscapeTabs } from "@/components/legal-landscape/legal-landscape-tabs";
import { LegalCTASection } from "@/components/legal-landscape/legal-cta-section";

export const metadata: Metadata = {
  title: "AI Likeness Rights by State | Legal Landscape | Consented AI",
  description:
    "Track AI likeness rights legislation across all 50 US states. Check your state's protection level, follow federal bills, and stay informed about legal developments.",
  openGraph: {
    title: "AI Likeness Rights by State | Consented AI",
    description:
      "The definitive tracker for AI likeness rights legislation across all 50 US states and federal level.",
    type: "website",
  },
};

export default function LegalLandscapePage() {
  return (
    <>
      <Navbar variant="dark" />
      <main className="min-h-screen pt-16">
        {/* Hero Section */}
        <section className="pt-12 pb-8 px-4 sm:pt-20 sm:pb-12 sm:px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-4xl mx-auto relative">
            <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl text-foreground mb-5">
              AI Likeness Rights{" "}
              <span className="text-primary">Legal Landscape</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Track legislation, check your state&apos;s protection level, and
              stay ahead of the rapidly evolving legal framework around
              AI-generated likenesses.
            </p>
          </div>
        </section>

        {/* Tabs Section */}
        <section className="pb-16 sm:pb-24">
          <LegalLandscapeTabs />
        </section>

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: "AI Likeness Rights Legal Landscape",
              description:
                "Track AI likeness rights legislation across all 50 US states.",
              publisher: {
                "@type": "Organization",
                name: "Consented AI",
              },
            }),
          }}
        />
      </main>
      <LegalCTASection />
      <NewFooter />
    </>
  );
}
