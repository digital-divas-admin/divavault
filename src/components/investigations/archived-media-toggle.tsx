"use client";

import { useState } from "react";
import { Archive, ChevronDown } from "lucide-react";

export function ArchivedMediaToggle({
  storageUrl,
  mediaType,
}: {
  storageUrl: string;
  mediaType: "video" | "image";
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full px-5 py-2.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border"
      >
        <Archive className="w-3.5 h-3.5" />
        <span>Archived copy</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div className={expanded ? "" : "hidden"}>
        {mediaType === "video" ? (
          <video
            src={storageUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[500px] bg-black"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={storageUrl}
            alt="Archived copy of media under investigation"
            loading="lazy"
            className="w-full max-h-[500px] object-contain bg-black"
          />
        )}
      </div>
    </div>
  );
}
