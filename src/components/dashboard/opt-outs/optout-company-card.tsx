"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Send,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  Loader2,
  MessageSquare,
  Clock,
  AlertCircle,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { SendOptOutDialog } from "@/components/dashboard/opt-outs/send-optout-dialog";
import { RecordResponseDialog } from "@/components/dashboard/opt-outs/record-response-dialog";
import { OptOutTimeline } from "@/components/dashboard/opt-outs/optout-timeline";
import type {
  OptOutCompanyView,
  OptOutRequestStatus,
  CompanyCategory,
  OptOutCommunication,
} from "@/types/optout";

interface OptOutCompanyCardProps {
  view: OptOutCompanyView;
  userName: string;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<
  OptOutRequestStatus,
  {
    label: string;
    variant: "secondary" | "primary" | "success" | "destructive" | "warning";
  }
> = {
  not_started: { label: "Not Started", variant: "secondary" },
  sent: { label: "Sent", variant: "primary" },
  follow_up_sent: { label: "Follow-up Sent", variant: "primary" },
  confirmed: { label: "Confirmed", variant: "success" },
  completed_web: { label: "Completed", variant: "success" },
  completed_settings: { label: "Completed", variant: "success" },
  denied: { label: "Denied", variant: "destructive" },
  unresponsive: { label: "Unresponsive", variant: "warning" },
};

const CATEGORY_LABELS: Record<CompanyCategory, string> = {
  model_training: "AI Training",
  image_generation: "Image Gen",
  content_platform: "Content Platform",
  social_media: "Social Media",
};

/* ------------------------------------------------------------------ */
/*  Minimal markdown renderer for instruction steps                    */
/* ------------------------------------------------------------------ */

function renderMarkdownInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const segment = match[0];
    if (segment.startsWith("**")) {
      parts.push(
        <strong key={key++} className="text-foreground">
          {segment.slice(2, -2)}
        </strong>
      );
    } else if (segment.startsWith("[")) {
      const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function parseInstructionSteps(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\d+\.\s*/, ""));
}

/* ------------------------------------------------------------------ */
/*  Card component                                                     */
/* ------------------------------------------------------------------ */

export function OptOutCompanyCard({
  view,
  userName,
  onUpdate,
}: OptOutCompanyCardProps) {
  const { company, request, communicationCount, lastActivity } = view;

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [communications, setCommunications] = useState<OptOutCommunication[]>(
    []
  );
  const [communicationsLoaded, setCommunicationsLoaded] = useState(false);

  const status: OptOutRequestStatus = request?.status || "not_started";
  const statusConfig = STATUS_CONFIG[status];

  const isEmailMethod =
    company.method === "email" || company.method === "none";
  const isWebOrSettings =
    company.method === "web_form" || company.method === "account_settings";
  const isCompleted =
    status === "confirmed" ||
    status === "completed_web" ||
    status === "completed_settings";
  const isSent = status === "sent" || status === "follow_up_sent";

  // Follow-up timing for email companies
  const daysSinceSent =
    request?.last_sent_at
      ? Math.floor(
          (Date.now() - new Date(request.last_sent_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;
  const daysUntilFollowUp =
    daysSinceSent !== null && request?.follow_up_days
      ? Math.max(0, request.follow_up_days - daysSinceSent)
      : null;

  // Parsed instruction steps for web/settings companies
  const instructionSteps =
    isWebOrSettings && company.instructionsMarkdown
      ? parseInstructionSteps(company.instructionsMarkdown)
      : [];

  async function handleComplete() {
    setCompleteLoading(true);
    try {
      const res = await fetch("/api/dashboard/opt-outs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_slug: company.slug }),
      });
      if (res.ok) onUpdate();
    } finally {
      setCompleteLoading(false);
    }
  }

  async function handleToggleTimeline() {
    if (!timelineOpen && !communicationsLoaded && request) {
      try {
        const res = await fetch(
          `/api/dashboard/opt-outs/communications?request_id=${request.id}`
        );
        if (res.ok) {
          const data = await res.json();
          setCommunications(data.communications || []);
          setCommunicationsLoaded(true);
        }
      } catch {
        // silently handle
      }
    }
    setTimelineOpen((prev) => !prev);
  }

  return (
    <>
      <Card
        className={`border-border/50 bg-card rounded-xl ${isCompleted ? "opacity-70" : ""}`}
      >
        <CardContent className="p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              <h3 className="font-semibold text-foreground">{company.name}</h3>
              <Badge variant="secondary" className="text-[10px]">
                {CATEGORY_LABELS[company.category]}
              </Badge>
            </div>
            <Badge
              variant={statusConfig.variant}
              className="text-[10px] shrink-0"
            >
              {statusConfig.label}
            </Badge>
          </div>

          {/* Data practices */}
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
            {company.dataPractices}
          </p>

          {/* ==================== EMAIL COMPANIES ==================== */}
          {isEmailMethod && !isCompleted && (
            <div className="space-y-3">
              {/* Not started */}
              {status === "not_started" && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>
                      We&apos;ll email{" "}
                      <strong className="text-foreground">
                        {company.contactEmail}
                      </strong>{" "}
                      on your behalf
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setSendDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Opt-Out Notice
                  </Button>
                </>
              )}

              {/* Sent / Follow-up sent */}
              {isSent && (
                <>
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-foreground">
                        Notice sent to {company.contactEmail}
                        {request?.last_sent_at && (
                          <span className="text-muted-foreground">
                            {" "}
                            — {timeAgo(request.last_sent_at)}
                          </span>
                        )}
                      </p>
                      {daysUntilFollowUp !== null && daysUntilFollowUp > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto follow-up in {daysUntilFollowUp} days if no
                          response
                        </p>
                      )}
                      {request?.follow_up_count !== undefined &&
                        request.follow_up_count > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {request.follow_up_count} follow-up
                            {request.follow_up_count > 1 ? "s" : ""} sent
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSendDialogOpen(true)}
                      className="gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Follow-Up
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResponseDialogOpen(true)}
                      className="gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Record Response
                    </Button>
                  </div>
                </>
              )}

              {/* Unresponsive */}
              {status === "unresponsive" && (
                <>
                  <div className="flex items-start gap-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 p-3">
                    <Clock className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-foreground">
                        No response after {request?.follow_up_count || 0}{" "}
                        follow-ups
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This is documented in your evidence trail
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResponseDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Record Late Response
                  </Button>
                </>
              )}

              {/* Denied */}
              {status === "denied" && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/10 p-3">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-foreground">Opt-out request denied</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The denial is documented in your evidence trail
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============== WEB / SETTINGS COMPANIES ================ */}
          {isWebOrSettings && !isCompleted && (
            <div className="space-y-3">
              {/* Step-by-step instructions */}
              {instructionSteps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    How to opt out
                  </p>
                  <ol className="space-y-2">
                    {instructionSteps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {renderMarkdownInline(step)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                {company.optOutUrl && (
                  <Button size="sm" asChild className="gap-1.5">
                    <a
                      href={company.optOutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {company.method === "account_settings"
                        ? `Open ${company.name} Settings`
                        : "Open Opt-Out Form"}
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComplete}
                  disabled={completeLoading}
                  className="gap-1.5"
                >
                  {completeLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  I&apos;ve Done This
                </Button>
              </div>
            </div>
          )}

          {/* =================== COMPLETED STATE ==================== */}
          {isCompleted && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
              <span className="text-accent">
                Completed
                {status === "confirmed" && " — opt-out confirmed by company"}
                {status === "completed_web" && " via web form"}
                {status === "completed_settings" && " via account settings"}
                {lastActivity && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {timeAgo(lastActivity)}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* =================== TIMELINE TOGGLE ==================== */}
          {request && communicationCount > 0 && (
            <div className="mt-4 pt-3 border-t border-border/30">
              <button
                type="button"
                onClick={handleToggleTimeline}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {timelineOpen ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    View {communicationCount} communication
                    {communicationCount > 1 ? "s" : ""}
                  </>
                )}
              </button>

              {timelineOpen && (
                <OptOutTimeline communications={communications} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SendOptOutDialog
        company={company}
        userName={userName}
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        onSend={onUpdate}
      />

      {request && (
        <RecordResponseDialog
          requestId={request.id}
          companyName={company.name}
          open={responseDialogOpen}
          onOpenChange={setResponseDialogOpen}
          onSubmit={onUpdate}
        />
      )}
    </>
  );
}
