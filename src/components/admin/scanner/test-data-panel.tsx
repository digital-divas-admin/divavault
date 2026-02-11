"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, FlaskConical, Trash2, Plus } from "lucide-react";
import type { SelectedContributor } from "./contributor-picker";

interface SeededData {
  scanJobId: string;
  discoveredImageId: string;
  matchId: string;
  evidenceId: string;
  takedownId: string;
}

interface TestDataPanelProps {
  contributor: SelectedContributor;
}

export function TestDataPanel({ contributor }: TestDataPanelProps) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seededData, setSeededData] = useState<SeededData[]>([]);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [confirmClean, setConfirmClean] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  async function handleSeed() {
    setSeeding(true);
    setError(null);
    setCleanResult(null);
    try {
      const res = await fetch("/api/admin/scanner/seed-test-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributorId: contributor.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Seed failed");
      }

      const { data } = await res.json();
      setSeededData((prev) => [...prev, data]);
      setConfirmSeed(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  async function handleClean() {
    setCleaning(true);
    setError(null);
    setCleanResult(null);
    try {
      const res = await fetch("/api/admin/scanner/clean-test-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributorId: contributor.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Cleanup failed");
      }

      const { deleted } = await res.json();
      setSeededData([]);
      setConfirmClean(false);
      setCleanResult(
        `Cleaned: ${deleted.scanJobs} jobs, ${deleted.matches} matches, ${deleted.evidence} evidence, ${deleted.takedowns} takedowns`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-purple-500" />
          Test Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {cleanResult && (
          <Alert>
            <AlertDescription>{cleanResult}</AlertDescription>
          </Alert>
        )}

        {seededData.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Seeded Items</p>
            {seededData.map((d, i) => (
              <div key={i} className="text-xs p-2 rounded bg-accent/30 font-mono space-y-0.5">
                <p>Match: {d.matchId}</p>
                <p>Scan Job: {d.scanJobId}</p>
                <p>Evidence: {d.evidenceId}</p>
                <p>Takedown: {d.takedownId}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Dialog open={confirmSeed} onOpenChange={setConfirmSeed}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Seed Test Match
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Seed test data for {contributor.name}?</DialogTitle>
                <DialogDescription>
                  This will create a complete match chain: scan job, discovered image,
                  match (92% confidence, high tier), evidence screenshot, and pending
                  takedown. The data will appear in the scanner dashboard.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmSeed(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSeed} disabled={seeding}>
                  {seeding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Seed Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={confirmClean} onOpenChange={setConfirmClean}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Trash2 className="h-4 w-4 mr-2" />
                Clean Test Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clean test data for {contributor.name}?</DialogTitle>
                <DialogDescription>
                  This will delete all seeded test data (scan jobs with type
                  &ldquo;test_seed&rdquo;) and their associated matches, evidence,
                  takedowns, and discovered images. Real scan data will not be affected.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmClean(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleClean} disabled={cleaning}>
                  {cleaning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Clean Up
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
