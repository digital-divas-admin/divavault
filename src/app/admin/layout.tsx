import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin-queries";
import { AdminSidebar, AdminMobileHeader } from "@/components/admin/admin-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
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

  const adminUser = await getAdminUser(user.id);
  if (!adminUser) {
    redirect("/dashboard");
  }

  const sidebarProps = {
    displayName: adminUser.display_name,
    role: adminUser.role,
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar {...sidebarProps} />
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <AdminMobileHeader {...sidebarProps} />
        <main className="flex-1 px-4 sm:px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
