import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUploadsWithSignedUrls } from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { PhotoGrid } from "@/components/dashboard/contributions/photo-grid";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, CheckCircle2, Clock, Camera } from "lucide-react";

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

      {uploads.length === 0 ? (
        <Card className="border-border/50 bg-card rounded-2xl">
          <CardContent className="p-8 sm:p-12 text-center">
            <Camera className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-2">
              No photos yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Your contributed photos will appear here. Start by uploading photos
              or completing the guided capture.
            </p>
            <Button asChild>
              <Link href="/onboarding">Start Contributing</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PhotoGrid initialUploads={uploads} />
      )}
    </div>
  );
}
