"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContributorPicker,
  type SelectedContributor,
} from "@/components/admin/scanner/contributor-picker";
import { EmbeddingPanel } from "@/components/admin/scanner/embedding-panel";
import { ScanTriggerPanel } from "@/components/admin/scanner/scan-trigger-panel";
import { TestDataPanel } from "@/components/admin/scanner/test-data-panel";
import { CrawlSchedulesPanel } from "@/components/admin/scanner/crawl-schedules-panel";
import { FlaskConical, Users } from "lucide-react";
import type { CrawlScheduleRow } from "@/lib/scanner-test-queries";

interface ScannerTestContentProps {
  initialCrawlSchedules: CrawlScheduleRow[];
}

export function ScannerTestContent({ initialCrawlSchedules }: ScannerTestContentProps) {
  const [contributor, setContributor] = useState<SelectedContributor | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Scanner Testing
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Test and control scanner behavior for individual contributors
        </p>
      </div>

      {/* Contributor Picker */}
      <Card className="bg-card border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Select Contributor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContributorPicker selected={contributor} onSelect={setContributor} />
        </CardContent>
      </Card>

      {/* Contributor-specific panels */}
      {contributor && (
        <>
          <EmbeddingPanel contributor={contributor} />
          <ScanTriggerPanel contributor={contributor} />
          <TestDataPanel contributor={contributor} />
        </>
      )}

      {/* Crawl Schedules — always visible */}
      <CrawlSchedulesPanel initialSchedules={initialCrawlSchedules} />
    </div>
  );
}
