import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const terms = [
  {
    term: "AI Training",
    definition:
      "The process of teaching an artificial intelligence model to recognize patterns by showing it large amounts of data — in this case, photos you contribute.",
  },
  {
    term: "Synthetic Images",
    definition:
      "Images created entirely by AI that don't depict real photographs. These are generated based on patterns learned during training.",
  },
  {
    term: "KYC (Know Your Customer)",
    definition:
      "Identity verification required to ensure every contributor is a real person contributing their own likeness. Processed by Sumsub.",
  },
  {
    term: "Consent",
    definition:
      "Your explicit, informed agreement to allow your photos to be used for AI training. You can review or revoke your consent at any time.",
  },
  {
    term: "Opt-Out",
    definition:
      "Withdrawing your photos from future AI training batches. Already-trained models cannot be un-trained, but your data won't be used going forward.",
  },
  {
    term: "Training Batch",
    definition:
      "A collection of approved photos that are processed together to train or update AI models. Batches run periodically.",
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
