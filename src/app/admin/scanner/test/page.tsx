import { getAllCrawlSchedules } from "@/lib/scanner-test-queries";
import { ScannerTestContent } from "./scanner-test-content";

export default async function ScannerTestPage() {
  const crawlSchedules = await getAllCrawlSchedules();

  return <ScannerTestContent initialCrawlSchedules={crawlSchedules} />;
}
