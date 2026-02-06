import { RequestForm } from "@/components/admin/request-form";

export default function NewRequestPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          New Request
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create a new bounty request for contributors
        </p>
      </div>

      <RequestForm mode="create" />
    </div>
  );
}
