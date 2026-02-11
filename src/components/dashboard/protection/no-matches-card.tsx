import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type EmbeddingState = "processing" | "ready" | "failed";

interface NoMatchesCardProps {
  embeddingState?: EmbeddingState;
}

export function NoMatchesCard({ embeddingState = "ready" }: NoMatchesCardProps) {
  if (embeddingState === "processing") {
    return (
      <Card className="border-primary/20 bg-primary/5 rounded-2xl">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
          <h3 className="font-semibold mb-1">Processing Your Photos</h3>
          <p className="text-sm text-muted-foreground">
            We&apos;re building your facial signature. Scanning will begin once
            your photos are processed.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (embeddingState === "failed") {
    return (
      <Card className="border-yellow-500/20 bg-yellow-500/5 rounded-2xl">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Photo Processing Issue</h3>
          <p className="text-sm text-muted-foreground">
            Some of your photos couldn&apos;t be processed. Please contact
            support or try re-uploading your photos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/20 bg-accent/5 rounded-2xl">
      <CardContent className="p-6 text-center">
        <ShieldCheck className="w-10 h-10 text-accent mx-auto mb-3" />
        <h3 className="font-semibold mb-1">All Clear</h3>
        <p className="text-sm text-muted-foreground">
          No unauthorized use of your likeness has been detected. We&apos;re
          continuously monitoring and will alert you if anything comes up.
        </p>
      </CardContent>
    </Card>
  );
}
