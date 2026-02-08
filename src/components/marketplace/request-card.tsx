import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BountyBadge } from "./bounty-badge";
import { ProgressIndicator } from "./progress-indicator";
import { DeadlineCountdown } from "./deadline-countdown";
import { BookmarkButton } from "./bookmark-button";
import type { BountyRequestWithMeta } from "@/types/marketplace";

const categoryLabels: Record<string, string> = {
  portrait: "Portrait",
  full_body: "Full Body",
  lifestyle: "Lifestyle",
  fashion: "Fashion",
  fitness: "Fitness",
  artistic: "Artistic",
  professional: "Professional",
  casual: "Casual",
  themed: "Themed",
  other: "Other",
};

interface RequestCardProps {
  request: BountyRequestWithMeta;
}

export function RequestCard({ request }: RequestCardProps) {
  return (
    <Link href={`/dashboard/marketplace/${request.id}`}>
      <Card className="bg-card border-border/30 hover:border-primary/30 transition-all cursor-pointer">
        <CardContent className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-[family-name:var(--font-heading)] font-semibold text-sm leading-tight line-clamp-1">
              {request.title}
            </h3>
            <BookmarkButton
              requestId={request.id}
              initialBookmarked={request.is_bookmarked || false}
            />
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-xs line-clamp-2 mb-3">
            {request.description}
          </p>

          {/* Tags row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {categoryLabels[request.category] || request.category}
            </Badge>
            <BountyBadge
              payAmountCents={request.pay_amount_cents}
              payType={request.pay_type}
            />
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <ProgressIndicator
              fulfilled={request.quantity_fulfilled}
              needed={request.quantity_needed}
            />
            <DeadlineCountdown deadline={request.deadline} />
          </div>

          {/* Existing submission indicator */}
          {request.existing_submission_status && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <span className="text-[10px] text-muted-foreground">
                Your submission:{" "}
                <span className="text-primary capitalize">
                  {request.existing_submission_status.replaceAll("_", " ")}
                </span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
