import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getContributor,
  getNotificationPreferences,
} from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProfileForm } from "@/components/dashboard/account/profile-form";
import { NotificationPreferences } from "@/components/dashboard/account/notification-preferences";
import { SecuritySection } from "@/components/dashboard/account/security-section";
import { ConnectedAccounts } from "@/components/dashboard/account/connected-accounts";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [contributor, notificationPrefs] = await Promise.all([
    getContributor(user.id),
    getNotificationPreferences(user.id),
  ]);

  if (!contributor) redirect("/onboarding");

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Account"
        description="Manage your profile and preferences."
      />

      <div className="grid gap-6">
        <ProfileForm
          fullName={contributor.full_name || ""}
          email={contributor.email}
          displayName={contributor.display_name}
          memberSince={contributor.created_at}
        />

        <NotificationPreferences preferences={notificationPrefs} />

        <SecuritySection lastLoginAt={contributor.last_login_at} />

        <ConnectedAccounts
          instagramUsername={contributor.instagram_username}
        />
      </div>
    </div>
  );
}
