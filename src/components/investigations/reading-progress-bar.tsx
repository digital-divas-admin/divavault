"use client";

import { useEffect, useRef, useState } from "react";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);
  const layoutRef = useRef({ top: 0, height: 0 });

  useEffect(() => {
    let rafId = 0;

    const article = document.querySelector("article");
    if (!article) return;
    articleRef.current = article;

    function cacheLayout() {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      layoutRef.current = {
        top: rect.top + window.scrollY,
        height: rect.height,
      };
    }

    function update() {
      const { top, height } = layoutRef.current;
      const total = height - window.innerHeight;
      if (total <= 0) return;

      const scrolled = window.scrollY - top;
      const pct = Math.min(100, Math.max(0, (scrolled / total) * 100));
      setProgress(scrolled > 100 ? pct : 0);
    }

    cacheLayout();

    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", cacheLayout, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", cacheLayout);
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (progress === 0) return null;

  return (
    <div
      className="reading-progress-bar fixed top-0 left-0 h-1 bg-primary z-50 transition-[width] duration-150 ease-out no-print"
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    />
  );
}
