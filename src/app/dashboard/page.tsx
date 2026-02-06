import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ImageIcon,
  Shield,
  DollarSign,
  Plus,
  FileText,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import type { DashboardContributor } from "@/types/dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: contributor } = await supabase
    .from("contributors")
    .select("*")
    .eq("id", user.id)
    .single();

  const c = contributor as DashboardContributor;
  const params = await searchParams;
  const isWelcome = params.welcome === "true";

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={`Welcome back${c?.display_name ? `, ${c.display_name}` : c?.full_name ? `, ${c.full_name.split(" ")[0]}` : ""}`}
        description="Here's an overview of your contribution status."
      />

      {/* First-visit celebration */}
      {isWelcome && (
        <Card className="border-neon/20 bg-neon/5 rounded-2xl mb-6">
          <CardContent className="p-5 sm:p-6 flex items-center gap-4">
            <Sparkles className="h-8 w-8 text-neon shrink-0" />
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold">
                You&apos;re officially a contributor!
              </h2>
              <p className="text-sm text-muted-foreground">
                Welcome to the vault. Your photos are being processed and
                you&apos;ll be notified as they enter the training pipeline.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What just happened summary */}
      <Card className="border-trust/20 bg-trust/5 rounded-2xl mb-6">
        <CardContent className="p-5 sm:p-6">
          <h2 className="font-semibold text-sm mb-4">
            Here&apos;s what just happened
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-trust shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                Your identity was verified — only you can contribute as you
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-trust shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                {c?.photo_count || 0} photos were securely uploaded to encrypted
                storage
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-trust shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                Your consent was recorded — you can review it anytime
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-trust shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                Your photos will enter the AI training pipeline within 48 hours
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <StatCard
          icon={ImageIcon}
          label="Photos Contributed"
          value={c?.photo_count || 0}
        />
        <Card className="border-border/50 bg-card/50 rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium">Verification</span>
            </div>
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
              {c?.sumsub_status === "green"
                ? "Verified"
                : c?.sumsub_status || "Pending"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Earnings</span>
            </div>
            <p className="text-2xl font-bold text-muted-foreground/50">--</p>
            <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Link href="/dashboard/contributions" className="block">
          <Card className="border-border/50 bg-card/50 rounded-xl hover:border-neon/30 transition-colors h-full">
            <CardContent className="p-5 text-center">
              <Plus className="h-6 w-6 text-neon mx-auto mb-2" />
              <h3 className="text-sm font-medium">Add More Photos</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Contribute additional photos
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/privacy" className="block">
          <Card className="border-border/50 bg-card/50 rounded-xl hover:border-neon/30 transition-colors h-full">
            <CardContent className="p-5 text-center">
              <FileText className="h-6 w-6 text-trust mx-auto mb-2" />
              <h3 className="text-sm font-medium">Review Consent</h3>
              <p className="text-xs text-muted-foreground mt-1">
                View your data rights
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/help" className="block">
          <Card className="border-border/50 bg-card/50 rounded-xl hover:border-neon/30 transition-colors h-full">
            <CardContent className="p-5 text-center">
              <HelpCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <h3 className="text-sm font-medium">Need Help?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                FAQ & support
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* What to Expect */}
      <Card className="border-border/50 bg-card/50 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">What to Expect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div>
            <h3 className="font-medium mb-1">
              Your photos are in the pipeline
            </h3>
            <p className="text-muted-foreground">
              Our team reviews new contributions within 48 hours. Once approved,
              your photos will be included in the next training batch.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Compensation is coming</h3>
            <p className="text-muted-foreground">
              We&apos;re building the payment system right now. Early
              contributors will be first in line when it launches — we&apos;ll
              notify you as soon as it&apos;s ready.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">
              You&apos;re always in control
            </h3>
            <p className="text-muted-foreground">
              Want to opt out? Visit{" "}
              <Link
                href="/dashboard/privacy"
                className="text-neon hover:underline"
              >
                Privacy & Data
              </Link>{" "}
              anytime. Your photos will be removed from all future training sets.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
