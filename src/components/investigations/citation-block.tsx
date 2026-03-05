"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { investigationUrl } from "@/lib/investigation-utils";

interface CitationBlockProps {
  title: string;
  slug: string;
  publishedAt: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatAPADate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  return `(${year}, ${month} ${day})`;
}

export function CitationBlock({ title, slug, publishedAt }: CitationBlockProps) {
  const [copiedApa, setCopiedApa] = useState(false);
  const [copiedJourno, setCopiedJourno] = useState(false);

  const url = investigationUrl(slug);
  const dateDisplay = publishedAt
    ? formatAPADate(publishedAt)
    : `(${new Date().getFullYear()})`;
  const fullDate = publishedAt
    ? dateFormatter.format(new Date(publishedAt))
    : dateFormatter.format(new Date());

  const apaCitation = `Consented AI. ${dateDisplay}. ${title}. Consented AI. ${url}`;
  const journoCitation = `"${title}," Consented AI, ${fullDate}, ${url}.`;

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6 sm:p-8">
      <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-5">
        Cite This Investigation
      </h2>

      <div className="space-y-4">
        {/* APA */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            APA
          </span>
          <div className="bg-muted rounded-lg p-4 flex items-start gap-3">
            <p className="font-[family-name:var(--font-mono)] text-sm text-foreground flex-1 break-all">
              {apaCitation}
            </p>
            <button
              onClick={() => copyText(apaCitation, setCopiedApa)}
              className="flex-shrink-0 p-1.5 rounded hover:bg-background/50 transition-colors"
              aria-label="Copy APA citation"
            >
              {copiedApa ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Journalistic */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            Journalistic
          </span>
          <div className="bg-muted rounded-lg p-4 flex items-start gap-3">
            <p className="font-[family-name:var(--font-mono)] text-sm text-foreground flex-1 break-all">
              {journoCitation}
            </p>
            <button
              onClick={() => copyText(journoCitation, setCopiedJourno)}
              className="flex-shrink-0 p-1.5 rounded hover:bg-background/50 transition-colors"
              aria-label="Copy journalistic citation"
            >
              {copiedJourno ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
