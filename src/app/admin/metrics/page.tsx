import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin-queries";
import { MetricsDashboard } from "@/components/admin/metrics/metrics-dashboard";

export default async function MetricsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminUser = await getAdminUser(user.id);
  if (!adminUser) {
    redirect("/dashboard");
  }

  return <MetricsDashboard />;
}
