"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

/* ── Context ── */

interface InquiryDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const InquiryDialogContext = createContext<InquiryDialogContextValue | null>(
  null
);

export function InquiryDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <InquiryDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </InquiryDialogContext.Provider>
  );
}

/* ── Trigger ── */

interface InquiryDialogTriggerProps {
  children?: ReactNode;
  className?: string;
}

export function InquiryDialogTrigger({
  children,
  className,
}: InquiryDialogTriggerProps) {
  const ctx = useContext(InquiryDialogContext);

  // Graceful fallback: if no provider, render as link to /signup
  if (!ctx) {
    return (
      <Link
        href="/signup"
        className={
          className ??
          "inline-flex items-center justify-center text-sm font-medium bg-[#DC2626] text-white px-5 py-2 rounded-full hover:bg-[#EF4444] transition-colors"
        }
      >
        {children ?? "Get Started"}
      </Link>
    );
  }

  return (
    <button
      onClick={() => ctx.setOpen(true)}
      className={
        className ??
        "inline-flex items-center justify-center text-sm font-medium bg-[#DC2626] text-white px-5 py-2 rounded-full hover:bg-[#EF4444] transition-colors"
      }
    >
      {children ?? "Discuss a Case"}
    </button>
  );
}

/* ── Dialog Content ── */

const caseTypeLabels: Record<string, string> = {
  litigation: "Litigation Support",
  takedown_escalation: "Takedown Escalation",
  proactive_protection: "Proactive Protection",
  other: "Other",
};

export function InquiryDialogContent() {
  const ctx = useContext(InquiryDialogContext);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      ctx?.setOpen(next);
      if (!next) {
        // Reset state after close animation
        setTimeout(() => {
          setSubmitted(false);
          setError(null);
        }, 200);
      }
    },
    [ctx]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      phone: (form.get("phone") as string) || undefined,
      company: (form.get("company") as string) || undefined,
      case_type: form.get("case_type") as string,
      message: (form.get("message") as string) || undefined,
    };

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ctx) return null;

  return (
    <Dialog open={ctx.open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto" />
            <DialogTitle className="text-xl">Thank you</DialogTitle>
            <DialogDescription>
              We&apos;ll review your inquiry and get back to you within one
              business day.
            </DialogDescription>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="mt-2"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Discuss a Case</DialogTitle>
              <DialogDescription>
                Tell us about your situation and we&apos;ll assess how we can
                help.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inq-name">Name *</Label>
                  <Input
                    id="inq-name"
                    name="name"
                    required
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inq-email">Email *</Label>
                  <Input
                    id="inq-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inq-phone">Phone</Label>
                  <Input
                    id="inq-phone"
                    name="phone"
                    type="tel"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inq-company">Company / Firm</Label>
                  <Input
                    id="inq-company"
                    name="company"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inq-case-type">Case Type *</Label>
                <Select name="case_type" required>
                  <SelectTrigger id="inq-case-type">
                    <SelectValue placeholder="Select a case type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(caseTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inq-message">Brief Description</Label>
                <Textarea
                  id="inq-message"
                  name="message"
                  placeholder="Tell us about the case..."
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-[#DC2626]">{error}</p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#DC2626] hover:bg-[#EF4444] text-white"
              >
                {submitting ? "Submitting..." : "Submit Inquiry"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
