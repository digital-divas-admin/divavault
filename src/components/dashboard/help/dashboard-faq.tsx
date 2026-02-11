import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqItems = [
  {
    question: "How does facial scanning work?",
    answer:
      "We create a unique facial signature from the photos you upload during onboarding. Our scanner compares this signature against images found on AI platforms. When we find a match above our confidence threshold, you're notified and can take action.",
  },
  {
    question: "What platforms do you monitor?",
    answer:
      "We monitor CivitAI, DeviantArt, Reddit AI communities, Hugging Face, and hundreds more. The exact number depends on your subscription tier. Free users get 2 platforms, while Protected and Premium members get full coverage.",
  },
  {
    question: "How long does a takedown take?",
    answer:
      "Most DMCA takedown requests are processed within 48-72 hours. Some platforms respond faster. You can track every takedown's status in real-time from your Matches page.",
  },
  {
    question: "What does a match 'confidence score' mean?",
    answer:
      "The confidence score (e.g., 94%) indicates how closely the discovered image matches your facial signature. Higher scores mean a stronger match. You can review every match and dismiss false positives.",
  },
  {
    question: "Can I remove my photos after contributing?",
    answer:
      "Yes. Go to Your Data and remove any photo you want. Your facial signature will be updated accordingly. You can also opt out entirely from the Privacy Controls tab.",
  },
  {
    question: "What happens if I delete my account?",
    answer:
      "Account deletion has a 30-day cooling period. After that, all your data is permanently removed: profile, photos, facial signatures, match history, and activity. Active takedowns will continue to completion.",
  },
  {
    question: "Is my facial data safe?",
    answer:
      "Your facial data is encrypted at rest and in transit. We never share it with third parties. The facial embeddings we create are mathematical representations — they cannot be reverse-engineered back into your photos.",
  },
];

export function DashboardFaq() {
  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-sm text-left">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
