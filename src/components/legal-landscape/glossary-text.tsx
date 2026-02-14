"use client";

import { cn } from "@/lib/utils";
import { glossaryEntries } from "@/data/legal-landscape/glossary";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface GlossaryTextProps {
  text: string;
  className?: string;
}

function buildSegments(
  text: string
): Array<{ type: "text"; value: string } | { type: "term"; value: string; definition: string }> {
  // Sort terms by length descending to avoid partial matches
  const sortedEntries = [...glossaryEntries].sort(
    (a, b) => b.term.length - a.term.length
  );

  // Build a single regex that matches any glossary term (case-insensitive)
  const escapedTerms = sortedEntries.map((entry) =>
    entry.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  // Create a lookup map for quick definition access (lowercase key)
  const definitionMap = new Map(
    glossaryEntries.map((entry) => [entry.term.toLowerCase(), entry.definition])
  );

  const segments: Array<
    | { type: "text"; value: string }
    | { type: "term"; value: string; definition: string }
  > = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add preceding plain text
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const matchedText = match[0];
    const definition = definitionMap.get(matchedText.toLowerCase());

    if (definition) {
      segments.push({ type: "term", value: matchedText, definition });
    } else {
      segments.push({ type: "text", value: matchedText });
    }

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

export function GlossaryText({ text, className }: GlossaryTextProps) {
  const segments = buildSegments(text);

  return (
    <TooltipProvider>
      <span className={cn(className)}>
        {segments.map((segment, i) => {
          if (segment.type === "text") {
            return <span key={i}>{segment.value}</span>;
          }

          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span className="border-b border-dotted border-muted-foreground/50 cursor-help">
                  {segment.value}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {segment.definition}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}
