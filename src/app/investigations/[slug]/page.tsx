import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/landing/navbar";
import { NewFooter } from "@/components/landing/new-footer";
import { InvestigationHero } from "@/components/investigations/investigation-hero";
import { ExecutiveSummary } from "@/components/investigations/executive-summary";
import { ClaimUnderReview } from "@/components/investigations/claim-under-review";
import { EvidenceTimeline } from "@/components/investigations/evidence-timeline";
import { FrameGallery } from "@/components/investigations/frame-gallery";
import { ConfidenceScoreDisplay } from "@/components/investigations/confidence-score-display";
import { CitationBlock } from "@/components/investigations/citation-block";
import { AiDetectionSection } from "@/components/investigations/ai-detection-section";
import { InvestigationCTA } from "@/components/investigations/investigation-cta";
import { RelatedInvestigations } from "@/components/investigations/related-investigations";
import { ReadingProgressBar } from "@/components/investigations/reading-progress-bar";
import { TableOfContents } from "@/components/investigations/table-of-contents";
import { VerdictBanner } from "@/components/investigations/verdict-banner";
import { MediaCorroborationSection } from "@/components/investigations/media-corroboration-section";
import { VideoTechnicalFingerprint } from "@/components/investigations/video-technical-fingerprint";
import { NewsletterSignup } from "@/components/investigations/newsletter-signup";
import { getInvestigationBySlug } from "@/lib/investigation-queries";
import { VERDICT_LABELS } from "@/types/investigations";
import { TwitterEmbed } from "@/components/investigations/twitter-embed";
import { InstagramEmbed } from "@/components/investigations/instagram-embed";
import { isTweetUrl, isInstagramUrl, estimateReadTime, verdictToRating, investigationUrl, SITE_BASE_URL, CORROBORATION_ENGINES } from "@/lib/investigation-utils";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { ExternalLink, Eye, Repeat2, Heart, MessageCircle } from "lucide-react";
import { ArchivedMediaToggle } from "@/components/investigations/archived-media-toggle";

const ENGAGEMENT_STATS = [
  { key: "views" as const, icon: Eye, color: "text-muted-foreground", label: "views" },
  { key: "reposts" as const, icon: Repeat2, color: "text-green-500", label: "reposts" },
  { key: "likes" as const, icon: Heart, color: "text-red-500", label: "likes" },
  { key: "replies" as const, icon: MessageCircle, color: "text-blue-500", label: "replies" },
];

// Ensure fresh signed storage URLs on every request
export const dynamic = "force-dynamic";

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
  const canonicalUrl = investigationUrl(investigation.slug);
  const description =
    investigation.summary ||
    `Deepfake investigation: ${investigation.title}. Verdict: ${verdictText}.`;

  return {
    title: `${investigation.title} | Consented AI`,
    description,
    keywords: [
      "deepfake",
      "investigation",
      "AI-generated",
      "forensic analysis",
      "fact check",
      investigation.category,
      verdictText,
    ],
    authors: [{ name: "Consented AI Forensic Team", url: SITE_BASE_URL }],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${investigation.title} | Deepfake Investigation`,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Consented AI",
      publishedTime: investigation.published_at || undefined,
      modifiedTime: investigation.updated_at,
      authors: ["Consented AI Forensic Team"],
    },
    twitter: {
      card: "summary_large_image",
      site: "@consentedai",
      title: `${investigation.title} | Consented AI`,
      description,
    },
  };
}

export default async function InvestigationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const investigation = await getInvestigationBySlug(slug);

  if (!investigation) {
    notFound();
  }

  const keyFrames = investigation.frames.filter(
    (f) => f.is_key_evidence || f.annotation_image_url
  );

  // Separate AI detection evidence from regular evidence
  const aiDetectionEvidence = investigation.evidence.filter(
    (e) => e.evidence_type === "ai_detection"
  );
  const displayEvidence = investigation.evidence.filter(
    (e) => e.evidence_type !== "ai_detection"
  );

  // Filter corroboration-relevant search results
  const corroborationResults = investigation.reverse_search_results.filter((r) =>
    CORROBORATION_ENGINES.includes(r.engine)
  );

  const verdictText = investigation.verdict
    ? VERDICT_LABELS[investigation.verdict]
    : null;
  const readTime = estimateReadTime(investigation);
  const canonicalUrl = investigationUrl(investigation.slug);

  // Build JSON-LD @graph
  const jsonLdGraph: Record<string, unknown>[] = [
    // BreadcrumbList
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_BASE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Investigations",
          item: `${SITE_BASE_URL}/investigations`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: investigation.title,
          item: canonicalUrl,
        },
      ],
    },
    // Article
    {
      "@type": "Article",
      headline: investigation.title,
      description: investigation.summary || investigation.description,
      datePublished: investigation.published_at,
      dateModified: investigation.updated_at,
      publisher: {
        "@type": "Organization",
        name: "Consented AI",
        url: SITE_BASE_URL,
      },
      author: {
        "@type": "Organization",
        name: "Consented AI",
        url: SITE_BASE_URL,
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      ...(investigation.summary
        ? {
            speakable: {
              "@type": "SpeakableSpecification",
              cssSelector: [".executive-summary-text"],
            },
          }
        : {}),
    },
  ];

  if (investigation.verdict) {
    jsonLdGraph.push({
      "@type": "ClaimReview",
      claimReviewed: investigation.description || investigation.title,
      reviewRating: {
        "@type": "Rating",
        ratingValue: verdictToRating(investigation.verdict),
        bestRating: 5,
        worstRating: 1,
        alternateName: verdictText,
      },
      ...(investigation.description
        ? {
            itemReviewed: {
              "@type": "Claim",
              name: investigation.description,
              ...(investigation.date_first_seen
                ? { datePublished: investigation.date_first_seen }
                : {}),
            },
          }
        : {}),
      author: {
        "@type": "Organization",
        name: "Consented AI",
        url: SITE_BASE_URL,
      },
      datePublished: investigation.published_at,
      url: canonicalUrl,
    });
  }

  // Compute allSources for TOC + Sources section
  const allSources = Array.from(
    new Set([
      ...investigation.source_urls,
      ...investigation.media.map((m) => m.source_url).filter(Boolean),
      ...investigation.evidence
        .filter((e) => e.external_url)
        .map((e) => e.external_url!),
    ])
  );

  return (
    <>
      <Navbar variant="dark" />
      <ReadingProgressBar />
      <main className="min-h-screen pt-16">
        <article>
        {/* 1. Hero */}
        <InvestigationHero investigation={investigation} readTime={readTime} />

        {/* Verdict Banner */}
        {investigation.verdict && (
          <VerdictBanner
            verdict={investigation.verdict}
            confidenceScore={investigation.confidence_score}
          />
        )}

        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 space-y-10">
          {/* 2. Executive Summary */}
          {investigation.summary && (
            <section id="executive-summary">
              <ExecutiveSummary summary={investigation.summary} />
            </section>
          )}

          {/* Table of Contents */}
          <TableOfContents
            hasSummary={!!investigation.summary}
            hasClaim={!!investigation.description || investigation.source_urls.length > 0}
            hasMedia={investigation.media.length > 0}
            hasEvidence={displayEvidence.length > 0}
            hasAiDetection={aiDetectionEvidence.length > 0}
            hasTechnicalFingerprint={investigation.media.some(
              (m) => m.media_type === "video" && (m.duration_seconds != null || m.fps != null || m.resolution_width != null)
            )}
            hasCorroboration={corroborationResults.length > 0}
            hasKeyFrames={keyFrames.length > 0}
            hasConfidence={investigation.confidence_score !== null}
            hasMethodology={!!investigation.methodology}
            hasSources={allSources.length > 0}
            evidenceItems={displayEvidence.map((e, i) => ({ index: i + 1, title: e.title }))}
          />

          {/* 3. Claim Under Review */}
          <section id="claim-under-review">
            <ClaimUnderReview
              sourceUrls={investigation.source_urls}
              description={investigation.description}
              dateFirstSeen={investigation.date_first_seen}
            />
          </section>

          {/* 4. Media Under Investigation */}
          {investigation.media.length > 0 && (
            <section id="media-under-investigation">
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
                    ) : isInstagramUrl(m.source_url) ? (
                      <InstagramEmbed url={m.source_url} />
                    ) : null}

                    {m.engagement_stats && (
                      <div className="px-5 py-3 border-t border-border bg-muted/30">
                        <div className="flex items-center gap-6 flex-wrap">
                          {ENGAGEMENT_STATS.map(({ key, icon: StatIcon, color, label }) => {
                            const val = m.engagement_stats?.[key];
                            if (val == null) return null;
                            return (
                              <div key={key} className="flex items-center gap-1.5 text-sm">
                                <StatIcon className={`w-4 h-4 ${color}`} />
                                <span className="font-semibold text-foreground">
                                  {formatCompactNumber(val)}
                                </span>
                                <span className="text-muted-foreground">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                        {m.engagement_stats.captured_at && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Stats captured {formatDate(m.engagement_stats.captured_at)}
                          </p>
                        )}
                      </div>
                    )}

                    {m.storage_url && (m.media_type === "video" || m.media_type === "image") ? (
                      (isTweetUrl(m.source_url) || isInstagramUrl(m.source_url)) ? (
                        <ArchivedMediaToggle storageUrl={m.storage_url} mediaType={m.media_type} />
                      ) : (
                        <div>
                          {m.media_type === "video" ? (
                            <video
                              src={m.storage_url}
                              controls
                              playsInline
                              className="w-full max-h-[500px] bg-black"
                            />
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={m.storage_url}
                              alt="Media under investigation"
                              className="w-full max-h-[500px] object-contain bg-black"
                            />
                          )}
                        </div>
                      )
                    ) : !isTweetUrl(m.source_url) && !isInstagramUrl(m.source_url) && m.source_url ? (
                      <div className="flex flex-col items-center gap-2 p-8 bg-black/30">
                        <span className="text-xs text-muted-foreground capitalize">
                          {m.platform || "External"}
                        </span>
                        <a
                          href={m.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on {m.platform || "source"}
                        </a>
                      </div>
                    ) : null}
                    <div className="px-5 py-3 flex items-center justify-end">
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

          {/* 5. Evidence Timeline */}
          {displayEvidence.length > 0 && (
            <section id="evidence">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-6">
                Evidence
              </h2>
              <EvidenceTimeline evidence={displayEvidence} />
            </section>
          )}

          {/* 5b. AI Detection Analysis (own section) */}
          {aiDetectionEvidence.length > 0 && (
            <AiDetectionSection evidence={aiDetectionEvidence} />
          )}

          {/* 5b2. Video Technical Fingerprint */}
          <VideoTechnicalFingerprint media={investigation.media} />

          {/* 5c. Media Corroboration */}
          {corroborationResults.length > 0 && (
            <MediaCorroborationSection results={corroborationResults} />
          )}

          {/* 6. Key Frames */}
          {keyFrames.length > 0 && (
            <section id="key-frames">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-6">
                Key Frames
              </h2>
              <FrameGallery frames={keyFrames} />
            </section>
          )}

          {/* 7. Confidence Score */}
          {investigation.confidence_score !== null && investigation.verdict && (
            <section id="confidence-score">
            <ConfidenceScoreDisplay
              score={investigation.confidence_score}
              verdict={investigation.verdict}
              evidenceCount={investigation.evidence.length}
            />
            </section>
          )}

          {/* 8. Methodology */}
          {investigation.methodology && (
            <section id="methodology" className="methodology-section bg-card border border-border rounded-xl p-6 sm:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-4">
                Methodology
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {investigation.methodology}
              </p>
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                Our forensic methodology is applied consistently across all investigations to ensure reliable, evidence-based conclusions.
              </p>
            </section>
          )}

          {/* 9. Sources */}
          {allSources.length > 0 && (
            <section id="sources" className="bg-card border border-border rounded-xl p-6 sm:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-4">
                Sources
              </h2>
              <ul className="space-y-2">
                {allSources.map((url, i) => (
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

          {/* 10. Citation Block */}
          <CitationBlock
            title={investigation.title}
            slug={investigation.slug}
            publishedAt={investigation.published_at}
          />

          {/* 11. Newsletter Signup */}
          <NewsletterSignup />

          {/* 12. CTA */}
          <div className="no-print">
            <InvestigationCTA />
          </div>

          {/* 13. Related Investigations */}
          <div className="no-print">
            <RelatedInvestigations
              currentId={investigation.id}
              category={investigation.category}
            />
          </div>
        </div>

        </article>

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": jsonLdGraph,
            }),
          }}
        />
      </main>
      <NewFooter />
    </>
  );
}
