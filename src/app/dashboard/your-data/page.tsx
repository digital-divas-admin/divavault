import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getContributor,
  getActivityLog,
  getUploadsWithSignedUrls,
} from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoGrid } from "@/components/dashboard/contributions/photo-grid";
import { StatCard } from "@/components/dashboard/stat-card";
import { ConsentSummary } from "@/components/dashboard/privacy/consent-summary";
import { OptOutCard } from "@/components/dashboard/privacy/opt-out-card";
import { DataExportCard } from "@/components/dashboard/privacy/data-export-card";
import { AccountDeletionCard } from "@/components/dashboard/privacy/account-deletion-card";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, CheckCircle2, Clock, Camera } from "lucide-react";

export default async function YourDataPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [contributor, activities, uploads] = await Promise.all([
    getContributor(user.id),
    getActivityLog(user.id),
    getUploadsWithSignedUrls(user.id),
  ]);

  if (!contributor) redirect("/onboarding");

  const activeCount = uploads.filter((u) => u.status === "active").length;
  const processingCount = uploads.filter(
    (u) => u.status === "processing"
  ).length;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Your Data"
        description="Manage your photos and privacy controls."
      />

      <Tabs defaultValue="photos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="photos">Photos Submitted</TabsTrigger>
          <TabsTrigger value="privacy">Privacy Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="photos">
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon={ImageIcon}
              label="Total Photos"
              value={uploads.length}
            />
            <StatCard
              icon={CheckCircle2}
              label="Active"
              value={activeCount}
            />
            <StatCard
              icon={Clock}
              label="Processing"
              value={processingCount}
            />
          </div>

          {uploads.length === 0 ? (
            <Card className="border-border/50 bg-card rounded-2xl">
              <CardContent className="p-8 sm:p-12 text-center">
                <Camera className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
                  No photos yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Your submitted photos will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <PhotoGrid initialUploads={uploads} />
          )}
        </TabsContent>

        <TabsContent value="privacy">
          <div className="max-w-3xl grid gap-6">
            <ConsentSummary
              consentDetails={contributor.consent_details}
              consentTimestamp={contributor.consent_timestamp}
              consentVersion={contributor.consent_version}
            />
            <OptOutCard optedOut={contributor.opted_out} />
            <DataExportCard />
            <AccountDeletionCard
              deletionScheduledFor={contributor.deletion_scheduled_for}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
