"use client";

import { useEffect, useMemo, useState } from "react";

interface TocSections {
  hasSummary: boolean;
  hasClaim: boolean;
  hasMedia: boolean;
  hasEvidence: boolean;
  hasAiDetection?: boolean;
  hasTechnicalFingerprint?: boolean;
  hasCorroboration?: boolean;
  hasKeyFrames: boolean;
  hasConfidence: boolean;
  hasMethodology: boolean;
  hasSources: boolean;
  evidenceItems: { index: number; title: string | null }[];
}

interface TocEntry {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

export function TableOfContents(props: TocSections) {
  const {
    hasSummary, hasClaim, hasMedia, hasEvidence, hasAiDetection,
    hasTechnicalFingerprint, hasCorroboration, hasKeyFrames, hasConfidence, hasMethodology, hasSources,
    evidenceItems,
  } = props;
  const [activeId, setActiveId] = useState<string>("");

  const entries: TocEntry[] = useMemo(() => {
    const result: TocEntry[] = [];
    if (hasSummary) result.push({ id: "executive-summary", label: "Executive Summary" });
    if (hasClaim) result.push({ id: "claim-under-review", label: "Claim Under Review" });
    if (hasMedia) result.push({ id: "media-under-investigation", label: "Media Under Investigation" });
    if (hasEvidence) {
      result.push({
        id: "evidence",
        label: "Evidence",
        children: evidenceItems.map((e) => ({
          id: `exhibit-${e.index}`,
          label: `Exhibit ${e.index}${e.title ? `: ${e.title}` : ""}`,
        })),
      });
    }
    if (hasAiDetection) result.push({ id: "ai-detection", label: "AI Detection Analysis" });
    if (hasTechnicalFingerprint) result.push({ id: "technical-fingerprint", label: "Technical Fingerprint" });
    if (hasCorroboration) result.push({ id: "media-corroboration", label: "Media Corroboration" });
    if (hasKeyFrames) result.push({ id: "key-frames", label: "Key Frames" });
    if (hasConfidence) result.push({ id: "confidence-score", label: "Confidence Score" });
    if (hasMethodology) result.push({ id: "methodology", label: "Methodology" });
    if (hasSources) result.push({ id: "sources", label: "Sources" });
    return result;
  }, [hasSummary, hasClaim, hasMedia, hasEvidence, hasAiDetection, hasTechnicalFingerprint, hasCorroboration, hasKeyFrames, hasConfidence, hasMethodology, hasSources, evidenceItems]);

  const allIds = useMemo(
    () => entries.flatMap((e) => e.children ? [e.id, ...e.children.map((c) => c.id)] : [e.id]),
    [entries]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (observerEntries) => {
        // Pick the topmost intersecting element to avoid flickering
        let topmost: IntersectionObserverEntry | null = null;
        for (const entry of observerEntries) {
          if (entry.isIntersecting) {
            if (!topmost || entry.boundingClientRect.top < topmost.boundingClientRect.top) {
              topmost = entry;
            }
          }
        }
        if (topmost) {
          setActiveId(topmost.target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const id of allIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [allIds]);

  if (entries.length === 0) return null;

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav className="bg-card border border-border border-l-4 border-l-primary rounded-xl p-5 sm:p-6 no-print">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
        Contents
      </h3>
      <ol className="space-y-1.5">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              onClick={() => scrollTo(entry.id)}
              className={`text-sm text-left w-full px-2 py-1 rounded transition-colors hover:text-primary ${
                activeId === entry.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {entry.label}
            </button>
            {entry.children && entry.children.length > 0 && (
              <ol className="ml-4 mt-1 space-y-0.5">
                {entry.children.map((child) => (
                  <li key={child.id}>
                    <button
                      onClick={() => scrollTo(child.id)}
                      className={`text-xs text-left w-full px-2 py-0.5 rounded transition-colors hover:text-primary ${
                        activeId === child.id
                          ? "text-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {child.label}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
