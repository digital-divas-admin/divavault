import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/landing/navbar";
import { NewFooter } from "@/components/landing/new-footer";
import { InvestigationHero } from "@/components/investigations/investigation-hero";
import { EvidenceTimeline } from "@/components/investigations/evidence-timeline";
import { FrameGallery } from "@/components/investigations/frame-gallery";
import { getInvestigationBySlug } from "@/lib/investigation-queries";
import { VERDICT_LABELS } from "@/types/investigations";
import { TwitterEmbed } from "@/components/investigations/twitter-embed";
import { isTweetUrl } from "@/lib/investigation-utils";
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

          {/* Media Under Investigation */}
          {investigation.media.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-6">
                Media Under Investigation
              </h2>
              <div className="space-y-4">
                {investigation.media.map((m) => (
                  <div
                    key={m.id}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                  >
                    {isTweetUrl(m.source_url) ? (
                      <TwitterEmbed tweetUrl={m.source_url} />
                    ) : m.storage_url && m.media_type === "video" ? (
                      <video
                        src={m.storage_url}
                        controls
                        playsInline
                        className="w-full max-h-[500px] bg-black"
                      />
                    ) : m.storage_url && m.media_type === "image" ? (
                      <img
                        src={m.storage_url}
                        alt="Media under investigation"
                        className="w-full max-h-[500px] object-contain bg-black"
                      />
                    ) : null}
                    <div className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {m.platform && (
                          <span className="capitalize">{m.platform}</span>
                        )}
                        {m.duration_seconds != null && (
                          <span>{Math.round(m.duration_seconds)}s</span>
                        )}
                        {m.resolution_width && m.resolution_height && (
                          <span>
                            {m.resolution_width}x{m.resolution_height}
                          </span>
                        )}
                      </div>
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Original source
                      </a>
                    </div>
                  </div>
                ))}
              </div>
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
