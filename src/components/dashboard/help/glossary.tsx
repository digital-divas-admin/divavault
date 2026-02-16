import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const terms = [
  {
    term: "Match",
    definition:
      "An image discovered on an AI platform that our system has identified as potentially containing your likeness. Each match includes a confidence score and can be reviewed, disputed, or acted upon.",
  },
  {
    term: "Confidence Tier",
    definition:
      "The level of certainty that a discovered image matches your facial signature. High confidence means a very strong match; lower tiers may require manual review.",
  },
  {
    term: "DMCA Takedown",
    definition:
      "A legal request under the Digital Millennium Copyright Act to remove content that uses your likeness without authorization. We file these automatically for Protected and Premium members.",
  },
  {
    term: "Takedown",
    definition:
      "The process of requesting removal of unauthorized content from a platform. Statuses include pending, submitted, completed (removed), and denied.",
  },
  {
    term: "Evidence",
    definition:
      "Screenshots, archived pages, and metadata captured to document unauthorized use of your likeness. Evidence is preserved with cryptographic hashes for legal proceedings.",
  },
  {
    term: "Face Embedding",
    definition:
      "A mathematical representation of your facial features used for comparison. Embeddings cannot be reverse-engineered into photos and are encrypted at rest.",
  },
  {
    term: "KYC (Know Your Customer)",
    definition:
      "Identity verification required to ensure every member is a real person. Processed by Veriff — we never store your ID documents.",
  },
  {
    term: "Consent",
    definition:
      "Your explicit, informed agreement about how your data is used. You can review or modify your consent preferences at any time from Your Data.",
  },
  {
    term: "Opt-Out",
    definition:
      "Withdrawing your photos and facial data from active scanning. You can opt back in at any time from Privacy Controls.",
  },
];

export function Glossary() {
  return (
    <Card className="border-border/50 bg-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Glossary</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {terms.map((item, i) => (
            <AccordionItem key={i} value={`term-${i}`}>
              <AccordionTrigger className="text-sm text-left">
                {item.term}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.definition}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
