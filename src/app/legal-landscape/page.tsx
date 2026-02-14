import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { LegalLandscapeTabs } from "@/components/legal-landscape/legal-landscape-tabs";
import { LegalCTASection } from "@/components/legal-landscape/legal-cta-section";

export const metadata: Metadata = {
  title: "AI Likeness Rights by State | Legal Landscape | Made Of Us",
  description:
    "Track AI likeness rights legislation across all 50 US states. Check your state's protection level, follow federal bills, and stay informed about legal developments.",
  openGraph: {
    title: "AI Likeness Rights by State | Made Of Us",
    description:
      "The definitive tracker for AI likeness rights legislation across all 50 US states and federal level.",
    type: "website",
  },
};

export default function LegalLandscapePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16">
        {/* Hero Section */}
        <section className="py-16 px-4 sm:py-24 sm:px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono text-primary tracking-wider">
                LIVE TRACKER
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl text-foreground mb-6">
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
                name: "Made Of Us",
              },
            }),
          }}
        />
      </main>
      <LegalCTASection />
      <Footer />
    </>
  );
}
