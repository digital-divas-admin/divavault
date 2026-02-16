"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { CommunicationType } from "@/types/optout";

interface RecordResponseDialogProps {
  requestId: string;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

type ResponseType = Extract<
  CommunicationType,
  "response" | "confirmation" | "denial"
>;

export function RecordResponseDialog({
  requestId,
  companyName,
  open,
  onOpenChange,
  onSubmit,
}: RecordResponseDialogProps) {
  const [responseText, setResponseText] = useState("");
  const [communicationType, setCommunicationType] =
    useState<ResponseType>("response");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!responseText.trim()) return;

    setLoading(true);
    try {
      // Step 1: Record the response
      const res = await fetch("/api/dashboard/opt-outs/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          response_text: responseText.trim(),
          communication_type: communicationType,
        }),
      });

      if (!res.ok) return;

      const data = await res.json();

      // Step 2: Upload evidence file if provided
      if (evidenceFile && data.communication_id) {
        const formData = new FormData();
        formData.append("file", evidenceFile);
        formData.append("communication_id", data.communication_id);

        await fetch("/api/dashboard/opt-outs/evidence", {
          method: "POST",
          body: formData,
        });
      }

      // Reset form
      setResponseText("");
      setCommunicationType("response");
      setEvidenceFile(null);
      onSubmit();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Response from {companyName}</DialogTitle>
          <DialogDescription>
            Log a response received from {companyName} regarding your opt-out
            request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Response text */}
          <div className="space-y-2">
            <Label htmlFor="response-text">Response Text</Label>
            <Textarea
              id="response-text"
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Paste the response email or message here..."
              className="min-h-[120px]"
            />
          </div>

          {/* Response type */}
          <div className="space-y-2">
            <Label>Response Type</Label>
            <Select
              value={communicationType}
              onValueChange={(v) => setCommunicationType(v as ResponseType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="response">Response</SelectItem>
                <SelectItem value="confirmation">Confirmation</SelectItem>
                <SelectItem value="denial">Denial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Evidence file */}
          <div className="space-y-2">
            <Label htmlFor="evidence-file">
              Evidence Screenshot (optional)
            </Label>
            <Input
              id="evidence-file"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !responseText.trim()}
            className="gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Submitting..." : "Submit Response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
