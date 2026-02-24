"use client";

import type { PlatformInfo } from "@/lib/scanner-command-queries";
import { parseSearchTermProgress } from "@/lib/scanner-coverage-utils";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";

interface SearchTermProgressProps {
  platforms: PlatformInfo[];
  selectedPlatform?: string;
}

export function SearchTermProgress({
  platforms,
  selectedPlatform,
}: SearchTermProgressProps) {
  const activePlatforms = selectedPlatform
    ? platforms.filter((p) => p.platform === selectedPlatform)
    : platforms.filter((p) => p.enabled);

  if (activePlatforms.length === 0) {
    return (
      <Card className="bg-card border-border/30">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No platforms selected
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activePlatforms.map((platform) => {
        const terms = parseSearchTermProgress(platform.search_terms);
        const exhaustedCount = terms.filter((t) => t.exhausted).length;

        if (terms.length === 0) {
          return (
            <Card key={platform.platform} className="bg-card border-border/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium capitalize text-foreground">
                    {platform.platform}
                  </h4>
                  <span className="text-[10px] text-muted-foreground">
                    No search terms tracked
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={platform.platform} className="bg-card border-border/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-medium capitalize text-foreground">
                  {platform.platform}
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  {exhaustedCount}/{terms.length} exhausted
                </span>
              </div>
              <div className="rounded-md border border-border/30 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 bg-card">
                      <th className="text-left p-2 font-medium text-muted-foreground">
                        Search Term
                      </th>
                      <th className="text-center p-2 font-medium text-muted-foreground w-20">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {terms.map((term) => (
                      <tr
                        key={term.term}
                        className="border-b border-border/20"
                      >
                        <td className="p-2 text-foreground font-mono text-[11px]">
                          {term.term}
                        </td>
                        <td className="p-2 text-center">
                          {term.exhausted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400 inline-block" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-yellow-400 inline-block" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
