import { getCommandCenterData } from "@/lib/scanner-command-queries";
import { CommandCenter } from "@/components/admin/scanner/command-center";

export const dynamic = "force-dynamic";

export default async function ScannerDashboardPage() {
  const data = await getCommandCenterData();

  return <CommandCenter initialData={data} />;
}
