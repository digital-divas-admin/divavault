"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How does facial scanning work?",
    a: "When you sign up, we create a unique facial signature from the photos you upload. Our scanner then compares this signature against images found on AI platforms like CivitAI, DeviantArt, and others. When we find a match above our confidence threshold, you're notified immediately.",
  },
  {
    q: "What platforms do you monitor?",
    a: "We currently monitor 247+ platforms including CivitAI, DeviantArt, Reddit AI communities, Hugging Face, and dozens more. We're adding new platforms every week as the AI landscape evolves.",
  },
  {
    q: "How long does a takedown take?",
    a: "Most DMCA takedown requests are processed within 48-72 hours. Some platforms respond faster. You can track the status of every takedown in real-time from your dashboard.",
  },
  {
    q: "Is my face data safe?",
    a: "Your facial data is encrypted at rest and in transit. We never share it with third parties. The facial embeddings we create are mathematical representations — they can't be reverse-engineered back into your photos.",
  },
  {
    q: "Can I protect multiple people?",
    a: "Yes, our Premium plan supports multi-person protection. This is ideal for agencies managing multiple creators or families who want to protect their children's likeness.",
  },
  {
    q: "What if I get a false positive?",
    a: "False positives can happen. Every match includes a confidence score and side-by-side comparison so you can review it yourself. You can dismiss false positives with one click, and our system learns from your feedback.",
  },
  {
    q: "Do I need to be a creator or influencer?",
    a: "Not at all. Anyone can use Made Of Us. If your face has ever appeared online — social media, news, group photos — it could be used to train AI models without your knowledge. Protection is for everyone.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-center mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground text-center mb-8 sm:mb-12">
          Everything you need to know about protecting your likeness.
        </p>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border border-border rounded-xl px-4 sm:px-6 bg-card data-[state=open]:border-primary/30"
            >
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline hover:text-primary py-5">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
