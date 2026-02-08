"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

interface Delivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string | null;
  attempts: number;
  status: string;
  created_at: string;
}

const EVENT_TYPES = [
  "contributor.onboarded",
  "contributor.consent_updated",
  "contributor.opted_out",
  "contributor.photos_added",
  "bounty.created",
  "bounty.submission_reviewed",
];

export default function WebhookLogPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (eventFilter !== "all") params.set("event_type", eventFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/webhook-log?${params}`);
      if (res.ok && !cancelled) {
        const data = await res.json();
        setDeliveries(data.deliveries);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [eventFilter, statusFilter, reloadKey]);

  function reloadDeliveries() {
    setReloadKey((k) => k + 1);
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">Delivered</Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/api-keys">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
              Webhook Delivery Log
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track webhook delivery status and debug failures
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reloadDeliveries}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {EVENT_TYPES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-lg">
          <p className="text-muted-foreground">No webhook deliveries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className="p-4 rounded-lg border border-border/30 bg-card space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {d.event_type}
                  </Badge>
                  {statusBadge(d.status)}
                  {d.response_status && (
                    <span className="text-[11px] text-muted-foreground">
                      HTTP {d.response_status}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Attempts: {d.attempts}
                {d.delivered_at && (
                  <> · Delivered {new Date(d.delivered_at).toLocaleString()}</>
                )}
              </div>
              {d.status === "failed" && d.response_body && (
                <pre className="text-[11px] text-destructive bg-destructive/5 rounded p-2 overflow-x-auto">
                  {d.response_body.slice(0, 200)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
