import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EarningsStatusBadge } from "@/components/admin/earnings-status-badge";
import type { Earning } from "@/types/dashboard";

interface EarningsHistoryProps {
  earnings: Earning[];
}

export function EarningsHistory({ earnings }: EarningsHistoryProps) {
  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Earnings History</CardTitle>
      </CardHeader>
      <CardContent>
        {earnings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No earnings yet. Complete bounty requests to start earning.
          </p>
        ) : (
          <div className="rounded-lg border border-border/30">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {e.description || "Earnings"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(e.amount_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <EarningsStatusBadge status={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
