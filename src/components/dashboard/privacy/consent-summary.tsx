import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface ConsentSummaryProps {
  consentDetails: Record<string, boolean> | null;
  consentTimestamp: string | null;
  consentVersion: string | null;
}

const consentLabels: Record<string, string> = {
  consentAge: "I am at least 18 years old",
  consentAiTraining: "I consent to my photos being used for AI training",
  consentLikeness: "I authorize use of my likeness in AI-generated content",
  consentRevocation: "I understand I can revoke consent at any time",
  consentPrivacy: "I have read and agree to the Privacy Policy",
  consentNsfw: "I consent to NSFW/adult content generation",
};

export function ConsentSummary({
  consentDetails,
  consentTimestamp,
  consentVersion,
}: ConsentSummaryProps) {
  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Consent Record</CardTitle>
        {consentVersion && (
          <Badge variant="secondary" className="text-[10px]">
            v{consentVersion}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {consentDetails ? (
          Object.entries(consentDetails).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 mt-0.5 ${value ? "text-green-500" : "text-muted-foreground/30"}`}
              />
              <span className="text-xs text-muted-foreground">
                {consentLabels[key] || key}
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            No consent details recorded.
          </p>
        )}
        {consentTimestamp && (
          <p className="text-[11px] text-muted-foreground/60 pt-2 border-t border-border/30">
            Consent recorded on{" "}
            {new Date(consentTimestamp).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
