import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvestigationDashboard } from "@/components/admin/investigations/investigation-dashboard";

export const dynamic = "force-dynamic";

export default async function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ investigationId: string }>;
}) {
  const { investigationId } = await params;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/investigations">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Investigation</h1>
      </div>
      <InvestigationDashboard id={investigationId} />
    </div>
  );
}
