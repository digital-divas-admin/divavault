"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";

const emojis = [
  { value: 1, emoji: "😞", label: "Poor" },
  { value: 2, emoji: "😕", label: "Fair" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😍", label: "Great" },
];

export function FeedbackForm() {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setLoading(true);
    const res = await fetch("/api/dashboard/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "feedback",
        category: "feedback",
        subject: `Rating: ${rating}/5`,
        message: feedback || `Rated ${rating}/5`,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setSent(true);
      setRating(null);
      setFeedback("");
    }
  };

  if (sent) {
    return (
      <Card className="border-secondary/20 bg-secondary/5 rounded-xl">
        <CardContent className="p-5 text-center">
          <Check className="h-6 w-6 text-secondary mx-auto mb-2" />
          <p className="text-sm font-medium">Thanks for your feedback!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Quick Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          How&apos;s your experience so far?
        </p>
        <div className="flex gap-2 justify-center">
          {emojis.map((item) => (
            <button
              key={item.value}
              onClick={() => setRating(item.value)}
              className={`text-2xl p-2 rounded-lg transition-colors ${
                rating === item.value
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "hover:bg-muted/50"
              }`}
              title={item.label}
            >
              {item.emoji}
            </button>
          ))}
        </div>
        {rating && (
          <>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Anything else you'd like to share? (optional)"
              rows={2}
              className="text-sm"
            />
            <Button onClick={handleSubmit} disabled={loading} size="sm">
              {loading ? "Sending..." : "Submit Feedback"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
