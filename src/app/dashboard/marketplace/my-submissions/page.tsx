import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMySubmissions } from "@/lib/marketplace-queries";
import { MySubmissionsList } from "@/components/marketplace/my-submissions-list";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function MySubmissionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const submissions = await getMySubmissions(user.id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/dashboard/marketplace"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          My Submissions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track the status of your marketplace submissions
        </p>
      </div>

      <MySubmissionsList submissions={submissions} />
    </div>
  );
}
