import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { ContributorSubmissionItem } from "@/lib/admin-queries";

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  in_review: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  accepted: "bg-green-500/10 text-green-600 border-green-500/20",
  revision_requested: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  withdrawn: "bg-muted text-muted-foreground",
};

interface UserSubmissionHistoryProps {
  submissions: ContributorSubmissionItem[];
}

export function UserSubmissionHistory({ submissions }: UserSubmissionHistoryProps) {
  if (submissions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No submissions yet.</p>
    );
  }

  return (
    <div className="rounded-lg border border-border/30 bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Earned</TableHead>
            <TableHead>Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <Link
                  href={`/admin/requests/${s.request_id}`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {s.request_title}
                </Link>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={statusStyles[s.status] || ""}
                >
                  {s.status.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {s.earned_amount_cents + s.bonus_amount_cents > 0
                  ? `$${((s.earned_amount_cents + s.bonus_amount_cents) / 100).toFixed(2)}`
                  : "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.submitted_at
                  ? new Date(s.submitted_at).toLocaleDateString()
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
