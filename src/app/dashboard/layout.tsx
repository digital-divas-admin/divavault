import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, MobileHeader } from "@/components/dashboard/sidebar";
import type { DashboardContributor } from "@/types/dashboard";
import type { SubscriptionTier } from "@/types/protection";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: contributor } = await supabase
    .from("contributors")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!contributor || !contributor.onboarding_completed) {
    redirect("/onboarding");
  }

  const c = contributor as DashboardContributor;

  // Get platform count
  const { count: platformCount } = await supabase
    .from("platform_crawl_schedule")
    .select("platform", { count: "exact", head: true })
    .eq("enabled", true);

  const sidebarProps = {
    userName: c.display_name || c.full_name || "Contributor",
    verified: c.verification_status === "green",
    tier: (c.subscription_tier || "free") as SubscriptionTier,
    platformsMonitored: platformCount || 0,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar {...sidebarProps} />
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <MobileHeader {...sidebarProps} />
        <main className="flex-1 px-4 sm:px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
