import { getAllContributors } from "@/lib/admin-queries";
import { UserTable } from "@/components/admin/user-table";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    verification?: string;
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 20;

  const { contributors, total } = await getAllContributors({
    search: params.search,
    verificationStatus: params.verification,
    page,
    pageSize,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Users
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} registered contributor{total !== 1 ? "s" : ""}
        </p>
      </div>

      <UserTable
        contributors={contributors}
        total={total}
        page={page}
        pageSize={pageSize}
      />
    </div>
  );
}
