"use client";

import { useCallback, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

interface FrameComparisonSliderProps {
  originalUrl: string;
  annotatedUrl: string;
  frameNumber: number;
  alt?: string;
}

export function FrameComparisonSlider({
  originalUrl,
  annotatedUrl,
  frameNumber,
  alt,
}: FrameComparisonSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const draggingRef = useRef(false);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef(0);

  const updatePosition = useCallback((clientX: number) => {
    const rect = rectRef.current;
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.min(100, Math.max(0, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      rectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const clientX = e.clientX;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => updatePosition(clientX));
    },
    [updatePosition]
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    rectRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  const altText = alt || `Frame #${frameNumber}`;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none cursor-col-resize overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Original (full width, behind) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={originalUrl}
        alt={`${altText} — Original`}
        loading="lazy"
        className="w-full block"
        draggable={false}
      />

      {/* Annotated (clipped overlay) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={annotatedUrl}
          alt={`${altText} — Annotated`}
          loading="lazy"
          className="w-full block"
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        {/* Grip handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
          <GripVertical className="w-4 h-4 text-gray-600" />
        </div>
      </div>

      {/* Labels */}
      <span className="absolute bottom-3 left-3 text-xs font-medium bg-black/50 text-white px-2 py-1 rounded pointer-events-none">
        Original
      </span>
      <span className="absolute bottom-3 right-3 text-xs font-medium bg-black/50 text-white px-2 py-1 rounded pointer-events-none">
        Annotated
      </span>
    </div>
  );
}
