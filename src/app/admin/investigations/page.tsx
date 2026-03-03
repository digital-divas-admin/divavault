import { InvestigationListTable } from "@/components/admin/investigations/investigation-list-table";

export const dynamic = "force-dynamic";

export default function InvestigationsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deepfake Lab</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Investigate and debunk AI-generated misinformation
        </p>
      </div>
      <InvestigationListTable />
    </div>
  );
}
