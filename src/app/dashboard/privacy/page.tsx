import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getContributor,
  getActivityLog,
  getUploadsWithSignedUrls,
} from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataInventory } from "@/components/dashboard/privacy/data-inventory";
import { ConsentSummary } from "@/components/dashboard/privacy/consent-summary";
import { OptOutCard } from "@/components/dashboard/privacy/opt-out-card";
import { DataExportCard } from "@/components/dashboard/privacy/data-export-card";
import { AccountDeletionCard } from "@/components/dashboard/privacy/account-deletion-card";
import { ActivityLog } from "@/components/dashboard/privacy/activity-log";

export default async function PrivacyPage() {
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

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Privacy & Data"
        description="View, export, and control your data. You're always in charge."
      />

      <div className="grid gap-6">
        <DataInventory
          photoCount={uploads.length}
          verified={contributor.verification_status === "green"}
          consentGiven={contributor.consent_given}
          activityCount={activities.length}
        />

        <ConsentSummary
          consentDetails={contributor.consent_details}
          consentTimestamp={contributor.consent_timestamp}
          consentVersion={contributor.consent_version}
        />

        <OptOutCard optedOut={contributor.opted_out} />

        <DataExportCard />

        <ActivityLog activities={activities} />

        <AccountDeletionCard
          deletionScheduledFor={contributor.deletion_scheduled_for}
        />
      </div>
    </div>
  );
}
