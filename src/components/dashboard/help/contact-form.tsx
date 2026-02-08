"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check } from "lucide-react";

interface ContactFormProps {
  userName: string;
  userEmail: string;
}

export function ContactForm({ userName, userEmail }: ContactFormProps) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !subject || !message) return;

    setLoading(true);
    const res = await fetch("/api/dashboard/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subject, message, type: "contact" }),
    });

    setLoading(false);
    if (res.ok) {
      setSent(true);
      setCategory("");
      setSubject("");
      setMessage("");
    }
  };

  if (sent) {
    return (
      <Card className="border-secondary/20 bg-secondary/5 rounded-xl">
        <CardContent className="p-6 text-center">
          <Check className="h-8 w-8 text-secondary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Message Sent</h3>
          <p className="text-sm text-muted-foreground">
            We&apos;ll get back to you as soon as possible.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setSent(false)}
          >
            Send Another Message
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Contact Support</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={userName} disabled className="mt-1 opacity-60" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={userEmail} disabled className="mt-1 opacity-60" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account">Account Issue</SelectItem>
                <SelectItem value="photos">Photos & Uploads</SelectItem>
                <SelectItem value="earnings">Earnings & Payments</SelectItem>
                <SelectItem value="privacy">Privacy & Data</SelectItem>
                <SelectItem value="technical">Technical Problem</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more about your issue..."
              rows={4}
              className="mt-1"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !category || !subject || !message}
          >
            {loading ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
