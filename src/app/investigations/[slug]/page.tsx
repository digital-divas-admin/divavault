import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/landing/navbar";
import { NewFooter } from "@/components/landing/new-footer";
import { InvestigationHero } from "@/components/investigations/investigation-hero";
import { EvidenceTimeline } from "@/components/investigations/evidence-timeline";
import { FrameGallery } from "@/components/investigations/frame-gallery";
import { getInvestigationBySlug } from "@/lib/investigation-queries";
import { VERDICT_LABELS } from "@/types/investigations";
import { ExternalLink, Link as LinkIcon } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const investigation = await getInvestigationBySlug(slug);

  if (!investigation) {
    return { title: "Investigation Not Found | Consented AI" };
  }

  const verdictText = investigation.verdict
    ? VERDICT_LABELS[investigation.verdict]
    : "Under Investigation";

  return {
    title: `${investigation.title} | Consented AI`,
    description:
      investigation.summary ||
      `Deepfake investigation: ${investigation.title}. Verdict: ${verdictText}.`,
    openGraph: {
      title: `${investigation.title} | Deepfake Investigation`,
      description:
        investigation.summary ||
        `Verdict: ${verdictText}. Read the full analysis.`,
      type: "article",
    },
  };
}

export default async function InvestigationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const investigation = await getInvestigationBySlug(slug);

  if (!investigation) {
    notFound();
  }

  const keyFrames = investigation.frames.filter((f) => f.is_key_evidence);
  const verdictText = investigation.verdict
    ? VERDICT_LABELS[investigation.verdict]
    : null;

  return (
    <>
      <Navbar variant="dark" />
      <main className="min-h-screen pt-16">
        {/* Hero */}
        <InvestigationHero investigation={investigation} />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 space-y-10">
          {/* Summary */}
          {investigation.summary && (
            <section className="bg-card border border-border rounded-xl p-6 sm:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-4">
                Summary
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {investigation.summary}
              </p>
            </section>
          )}

          {/* Evidence Timeline */}
          {investigation.evidence.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-6">
                Evidence
              </h2>
              <EvidenceTimeline evidence={investigation.evidence} />
            </section>
          )}

          {/* Key Frames */}
          {keyFrames.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-6">
                Key Frames
              </h2>
              <FrameGallery frames={keyFrames} />
            </section>
          )}

          {/* Methodology */}
          {investigation.methodology && (
            <section className="bg-card border border-border rounded-xl p-6 sm:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-4">
                Methodology
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {investigation.methodology}
              </p>
            </section>
          )}

          {/* Source URLs */}
          {investigation.source_urls.length > 0 && (
            <section className="bg-card border border-border rounded-xl p-6 sm:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-4">
                Sources
              </h2>
              <ul className="space-y-2">
                {investigation.source_urls.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline break-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Share */}
          <section className="bg-card border border-border rounded-xl p-6 sm:p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-4">
              Share This Investigation
            </h2>
            <div className="flex items-center gap-3">
              <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <code className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg break-all flex-1">
                {`https://consented.ai/investigations/${investigation.slug}`}
              </code>
            </div>
          </section>
        </div>

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: investigation.title,
              description: investigation.summary || investigation.description,
              datePublished: investigation.published_at,
              dateModified: investigation.updated_at,
              publisher: {
                "@type": "Organization",
                name: "Consented AI",
              },
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://consented.ai/investigations/${investigation.slug}`,
              },
              ...(verdictText
                ? {
                    review: {
                      "@type": "Review",
                      reviewBody: `Verdict: ${verdictText}`,
                    },
                  }
                : {}),
            }),
          }}
        />
      </main>
      <NewFooter />
    </>
  );
}
