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
  Globe,
  Settings,
  AlertCircle,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { SendOptOutDialog } from "@/components/dashboard/opt-outs/send-optout-dialog";
import { RecordResponseDialog } from "@/components/dashboard/opt-outs/record-response-dialog";
import { OptOutTimeline } from "@/components/dashboard/opt-outs/optout-timeline";
import type {
  OptOutCompanyView,
  OptOutRequestStatus,
  OptOutMethod,
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
  { label: string; variant: "secondary" | "primary" | "success" | "destructive" | "warning" }
> = {
  not_started: { label: "Not Started", variant: "secondary" },
  sent: { label: "Sent", variant: "primary" },
  follow_up_sent: { label: "Follow-up Sent", variant: "primary" },
  confirmed: { label: "Confirmed", variant: "success" },
  completed_web: { label: "Completed (Web)", variant: "success" },
  completed_settings: { label: "Completed (Settings)", variant: "success" },
  denied: { label: "Denied", variant: "destructive" },
  unresponsive: { label: "Unresponsive", variant: "warning" },
};

const CATEGORY_LABELS: Record<CompanyCategory, string> = {
  model_training: "AI Training",
  image_generation: "Image Gen",
  content_platform: "Content Platform",
  social_media: "Social Media",
};

const METHOD_LABELS: Record<OptOutMethod, string> = {
  email: "Email",
  web_form: "Web Form",
  account_settings: "Settings",
  none: "Email Fallback",
};

const METHOD_ICONS: Record<OptOutMethod, typeof Mail> = {
  email: Mail,
  web_form: Globe,
  account_settings: Settings,
  none: AlertCircle,
};

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
  const MethodIcon = METHOD_ICONS[company.method];

  const isEmailMethod =
    company.method === "email" || company.method === "none";
  const isWebOrSettings =
    company.method === "web_form" || company.method === "account_settings";
  const isTerminal =
    status === "confirmed" ||
    status === "completed_web" ||
    status === "completed_settings";

  async function handleComplete() {
    setCompleteLoading(true);
    try {
      const res = await fetch("/api/dashboard/opt-outs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_slug: company.slug }),
      });
      if (res.ok) {
        onUpdate();
      }
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
        // Silently handle fetch error
      }
    }
    setTimelineOpen((prev) => !prev);
  }

  return (
    <>
      <Card className="border-border/50 bg-card rounded-xl">
        <CardContent className="p-4 sm:p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground">
                {company.name}
              </h3>
              <Badge variant="secondary" className="text-[10px]">
                {CATEGORY_LABELS[company.category]}
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <MethodIcon className="w-2.5 h-2.5" />
                {METHOD_LABELS[company.method]}
              </Badge>
            </div>
            <Badge
              variant={statusConfig.variant}
              className="text-[10px] shrink-0"
            >
              {statusConfig.label}
            </Badge>
          </div>

          {/* Data practices summary */}
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
            {company.dataPractices}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {isEmailMethod && !isTerminal && (
              <Button
                size="sm"
                onClick={() => setSendDialogOpen(true)}
                className="gap-1.5"
                disabled={status === "denied"}
              >
                <Send className="w-3.5 h-3.5" />
                {status === "not_started"
                  ? "Send Opt-Out Notice"
                  : "Send Follow-Up"}
              </Button>
            )}

            {isWebOrSettings && !isTerminal && (
              <>
                {company.optOutUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="gap-1.5"
                  >
                    <a
                      href={company.optOutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Visit Site
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={completeLoading}
                  className="gap-1.5"
                >
                  {completeLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Mark as Complete
                </Button>
              </>
            )}

            {request && !isTerminal && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResponseDialogOpen(true)}
                className="gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Record Response
              </Button>
            )}
          </div>

          {/* Request info + timeline toggle */}
          {request && (
            <div className="mt-4 pt-3 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {communicationCount}{" "}
                    {communicationCount === 1
                      ? "communication"
                      : "communications"}
                  </span>
                  {lastActivity && (
                    <span>Last activity: {timeAgo(lastActivity)}</span>
                  )}
                </div>

                {communicationCount > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleTimeline}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {timelineOpen ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Hide timeline
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        View timeline
                      </>
                    )}
                  </button>
                )}
              </div>

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
