import Link from "next/link";
import { getAllRequests } from "@/lib/admin-queries";
import { RequestList } from "@/components/admin/request-list";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function AdminRequestsPage() {
  const requests = await getAllRequests();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Requests
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all bounty requests
          </p>
        </div>
        <Link href="/admin/requests/new">
          <Button className="neon-glow">
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </Link>
      </div>

      <RequestList requests={requests} />
    </div>
  );
}
