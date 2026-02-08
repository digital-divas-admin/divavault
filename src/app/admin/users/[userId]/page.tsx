import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getContributorAdmin,
  getSubmissionsForContributor,
} from "@/lib/admin-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerificationStatusBadge } from "@/components/admin/verification-status-badge";
import { UserActions } from "@/components/admin/user-actions";
import { UserSubmissionHistory } from "@/components/admin/user-submission-history";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Camera,
  Instagram,
  Ban,
  AlertTriangle,
  DollarSign,
  Clock,
  CheckCircle2,
} from "lucide-react";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const [user, submissions] = await Promise.all([
    getContributorAdmin(userId),
    getSubmissionsForContributor(userId),
  ]);

  if (!user) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link href="/admin/users">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </Link>

      {/* Profile card */}
      <Card className="bg-card border-border/30">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">
                {user.display_name || user.full_name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </div>
            </div>
            <VerificationStatusBadge status={user.sumsub_status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Joined</p>
              <p className="flex items-center gap-1.5 font-medium">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Login</p>
              <p className="font-medium">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleDateString()
                  : "Never"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Photos</p>
              <p className="flex items-center gap-1.5 font-medium">
                <Camera className="h-3.5 w-3.5" />
                {user.photo_count}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Instagram</p>
              <p className="flex items-center gap-1.5 font-medium">
                <Instagram className="h-3.5 w-3.5" />
                {user.instagram_username || "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Consent</p>
              <p className="font-medium">
                {user.consent_given ? "Given" : "Not given"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Onboarding</p>
              <p className="font-medium">
                {user.onboarding_completed ? "Complete" : "Incomplete"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Opted Out</p>
              <p className="font-medium">
                {user.opted_out ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Submissions</p>
              <p className="font-medium">{user.submission_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account status */}
      {(user.suspended || user.flagged) && (
        <Card className="bg-card border-border/30">
          <CardContent className="p-4 space-y-2">
            {user.suspended && (
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-500" />
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                  Suspended
                </Badge>
                {user.suspended_at && (
                  <span className="text-xs text-muted-foreground">
                    since {new Date(user.suspended_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
            {user.flagged && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Flagged
                  </Badge>
                  {user.flag_reason && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {user.flag_reason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Earnings summary */}
      <Card className="bg-card border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-lg font-bold">
                  ${(user.total_earned_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-lg font-bold">
                  ${(user.pending_earned_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold">
                  ${(user.paid_earned_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="bg-card border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <UserActions
            userId={user.id}
            suspended={user.suspended}
            flagged={user.flagged}
            flagReason={user.flag_reason}
          />
        </CardContent>
      </Card>

      {/* Submission history */}
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold mb-3">
          Submission History
        </h2>
        <UserSubmissionHistory submissions={submissions} />
      </div>
    </div>
  );
}
