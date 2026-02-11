import { notFound } from "next/navigation";
import Link from "next/link";
import { getMatchDetail } from "@/lib/scanner-admin-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/admin/scanner/confidence-badge";
import { MatchStatusBadge } from "@/components/admin/scanner/match-status-badge";
import { TakedownStatusBadge } from "@/components/admin/scanner/takedown-status-badge";
import {
  ArrowLeft,
  User,
  Image,
  Target,
  Bot,
  FileText,
  Gavel,
  ExternalLink,
} from "lucide-react";

interface PageProps {
  params: Promise<{ matchId: string }>;
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params;
  const match = await getMatchDetail(matchId);

  if (!match) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/scanner/matches">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Match Detail
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {match.contributor_name} &middot;{" "}
            {new Date(match.created_at).toLocaleString()}
          </p>
        </div>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contributor Info */}
        <Card className="bg-card border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Contributor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <Link
                href={`/admin/users/${match.contributor_id}`}
                className="text-primary hover:underline"
              >
                {match.contributor_name}
              </Link>
            </div>
            {match.source_account && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source Account</span>
                <span>{match.source_account}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Known Account</span>
              <span>{match.is_known_account ? "Yes" : "No"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Discovered Image */}
        <Card className="bg-card border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Image className="h-4 w-4 text-blue-500" />
              Discovered Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {match.discovered_image ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Platform</span>
                  <span>{match.discovered_image.platform || "-"}</span>
                </div>
                {match.discovered_image.page_title && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Page</span>
                    <span className="truncate text-right">{match.discovered_image.page_title}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Size</span>
                  <span>
                    {match.discovered_image.width && match.discovered_image.height
                      ? `${match.discovered_image.width}x${match.discovered_image.height}`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Faces</span>
                  <span>{match.discovered_image.face_count ?? "-"}</span>
                </div>
                {match.discovered_image.source_url && (
                  <a
                    href={match.discovered_image.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs mt-1"
                  >
                    View source image <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No image data</p>
            )}
          </CardContent>
        </Card>

        {/* Similarity / Confidence */}
        <Card className="bg-card border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Similarity &amp; Confidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Similarity Score</span>
              <span className="font-mono font-bold text-lg">
                {(match.similarity_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Confidence</span>
              <ConfidenceBadge confidence={match.confidence_tier} />
            </div>
            {match.face_index !== null && match.face_index > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Face Index</span>
                <span>{match.face_index}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Detection */}
        <Card className="bg-card border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-500" />
              AI Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">AI Generated</span>
              {match.is_ai_generated ? (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                  Yes
                </Badge>
              ) : (
                <span>{match.is_ai_generated === false ? "No" : "Unknown"}</span>
              )}
            </div>
            {match.ai_detection_score !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detection Score</span>
                <span className="font-mono">
                  {(match.ai_detection_score * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {match.ai_generator && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generator</span>
                <span>{match.ai_generator}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evidence */}
      <Card className="bg-card border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-500" />
            Evidence ({match.evidence.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {match.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence collected</p>
          ) : (
            <div className="space-y-2">
              {match.evidence.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/30 text-sm"
                >
                  <div>
                    <p className="font-medium">{e.evidence_type}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      SHA-256: {e.sha256_hash.slice(0, 16)}...
                    </p>
                  </div>
                  <div className="text-right text-muted-foreground text-xs">
                    {e.file_size_bytes
                      ? `${(e.file_size_bytes / 1024).toFixed(1)} KB`
                      : ""}
                    <br />
                    {new Date(e.captured_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Takedowns */}
      <Card className="bg-card border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gavel className="h-4 w-4 text-yellow-500" />
            Takedowns ({match.takedowns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {match.takedowns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No takedowns initiated</p>
          ) : (
            <div className="space-y-2">
              {match.takedowns.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/30 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {t.platform} &middot; {t.takedown_type.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(t.created_at).toLocaleDateString()}
                      {t.submitted_at &&
                        ` | Submitted ${new Date(t.submitted_at).toLocaleDateString()}`}
                      {t.resolved_at &&
                        ` | Resolved ${new Date(t.resolved_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <TakedownStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
