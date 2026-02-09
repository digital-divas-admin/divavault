import { notFound } from "next/navigation";
import Link from "next/link";
import { getRequestById } from "@/lib/marketplace-queries";
import { getSubmissionsForRequest } from "@/lib/admin-queries";
import { RequestForm } from "@/components/admin/request-form";
import { RequestStatusBadge } from "@/components/admin/request-status-badge";
import { BountyBadge } from "@/components/marketplace/bounty-badge";
import { ProgressIndicator } from "@/components/marketplace/progress-indicator";
import { RequestActions } from "@/components/admin/request-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const request = await getRequestById(requestId);

  if (!request) {
    notFound();
  }

  const isEditable =
    request.status === "draft" || request.status === "pending_review";

  // For non-editable, get submission count
  const submissions = !isEditable
    ? await getSubmissionsForRequest(requestId, "all")
    : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/admin/requests"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to requests
      </Link>

      {isEditable ? (
        <>
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
              Edit Request
            </h1>
            <RequestStatusBadge status={request.status} />
          </div>
          <RequestForm existingRequest={request} mode="edit" />
          <RequestActions request={request} />
        </>
      ) : (
        <>
          {/* Read-only view */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
                  {request.title}
                </h1>
                <RequestStatusBadge status={request.status} />
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="capitalize">
                  {request.category.replaceAll("_", " ")}
                </span>
                <span>·</span>
                <BountyBadge
                  payAmountCents={request.pay_amount_cents}
                  payType={request.pay_type}
                />
              </div>
            </div>
            <ProgressIndicator
              fulfilled={request.quantity_fulfilled}
              needed={request.quantity_needed}
              size="md"
            />
          </div>

          <Card className="bg-card border-border/30">
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {request.description}
              </p>
              {request.model_context && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Model Context
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.model_context}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border/30">
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Budget</dt>
                  <dd className="font-medium">
                    ${(request.budget_spent_cents / 100).toFixed(2)} / $
                    {(request.budget_total_cents / 100).toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Min Resolution</dt>
                  <dd className="font-medium">
                    {request.min_resolution_width}×{request.min_resolution_height}
                  </dd>
                </div>
                {request.deadline && (
                  <div>
                    <dt className="text-muted-foreground">Deadline</dt>
                    <dd className="font-medium">
                      {new Date(request.deadline).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                {request.quality_guidelines && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Quality Guidelines</dt>
                    <dd className="font-medium">{request.quality_guidelines}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Actions */}
          <RequestActions request={request} />

          {/* Submissions link */}
          <Link href={`/admin/requests/${requestId}/submissions`}>
            <Card className="bg-card border-border/30 hover:bg-card transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">
                      View Submissions ({submissions.length})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Review contributor submissions for this request
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </CardContent>
            </Card>
          </Link>
        </>
      )}
    </div>
  );
}
