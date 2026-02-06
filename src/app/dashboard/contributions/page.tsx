import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUploadsWithSignedUrls } from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { PhotoGrid } from "@/components/dashboard/contributions/photo-grid";
import { StatCard } from "@/components/dashboard/stat-card";
import { ImageIcon, CheckCircle2, Clock } from "lucide-react";

export default async function ContributionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const uploads = await getUploadsWithSignedUrls(user.id);
  const activeCount = uploads.filter((u) => u.status === "active").length;
  const processingCount = uploads.filter(
    (u) => u.status === "processing"
  ).length;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="My Contributions"
        description="Manage photos you've contributed to AI training."
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={ImageIcon}
          label="Total Photos"
          value={uploads.length}
        />
        <StatCard
          icon={CheckCircle2}
          label="Active in Training"
          value={activeCount}
        />
        <StatCard
          icon={Clock}
          label="Processing"
          value={processingCount}
        />
      </div>

      <PhotoGrid initialUploads={uploads} />
    </div>
  );
}
