import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { NewFooter } from "@/components/landing/new-footer";
import { InvestigationCard } from "@/components/investigations/investigation-card";
import { getPublishedInvestigations } from "@/lib/investigation-queries";
import { investigationUrl, SITE_BASE_URL } from "@/lib/investigation-utils";
import { SearchSlash } from "lucide-react";

export const metadata: Metadata = {
  title: "Deepfake Investigations | Consented AI",
  description:
    "Browse published deepfake investigations. Our team analyzes suspected AI-generated media, providing evidence-based verdicts on authenticity.",
  openGraph: {
    title: "Deepfake Investigations | Consented AI",
    description:
      "Evidence-based deepfake investigations and authenticity analysis.",
    type: "website",
  },
};

export default async function InvestigationsPage() {
  const investigations = await getPublishedInvestigations();

  return (
    <>
      <Navbar variant="dark" />
      <main className="min-h-screen pt-16">
        {/* Hero Section */}
        <section className="pt-12 pb-8 px-4 sm:pt-20 sm:pb-12 sm:px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-4xl mx-auto relative">
            <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl text-foreground mb-5">
              Deepfake{" "}
              <span className="text-primary">Investigations</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Independent forensic analysis of suspected AI-generated media.
              Evidence-based verdicts you can cite, share, and trust.
            </p>
            {investigations.length > 0 && (
              <p className="text-sm text-muted-foreground mt-3">
                {investigations.length} investigation{investigations.length !== 1 ? "s" : ""} published
              </p>
            )}
          </div>
        </section>

        {/* Investigation Grid */}
        <section className="pb-16 sm:pb-24 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            {investigations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {investigations.map((investigation) => (
                  <InvestigationCard
                    key={investigation.id}
                    investigation={investigation}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <SearchSlash className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  No investigations published yet
                </h2>
                <p className="text-muted-foreground">
                  Check back soon for our first deepfake analysis reports.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Deepfake Investigations",
              url: `${SITE_BASE_URL}/investigations`,
              description:
                "Evidence-based deepfake investigations and authenticity analysis by Consented AI.",
              publisher: {
                "@type": "Organization",
                name: "Consented AI",
                url: SITE_BASE_URL,
              },
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: investigations.length,
                itemListElement: investigations.map((inv, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: investigationUrl(inv.slug),
                  name: inv.title,
                })),
              },
            }),
          }}
        />
      </main>
      <NewFooter />
    </>
  );
}
