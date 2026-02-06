"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What will my photos be used for?",
    a: "Your photos will be used exclusively to train ethical AI models. This includes AI-generated influencer content, digital avatars, and visual media. Your images are never sold to third parties or shared publicly. You can see what you've shared from your dashboard at any time.",
  },
  {
    q: "How does compensation work?",
    a: "We're building the payment system now — it isn't live yet, and we want to be upfront about that. When it launches, you'll be compensated based on how your contributed images are used in AI training datasets. Early contributors will be first in line for payouts.",
  },
  {
    q: "Can I opt out after contributing?",
    a: "Yes, absolutely. You can opt out at any time by contacting our support team. When you opt out, your images are removed from all future training sets. We want to be transparent about one thing: AI models that have already been trained can't be un-trained — that's a technical limitation, not a choice we made. But your photos will never be used in new training after you opt out.",
  },
  {
    q: "What is identity verification for?",
    a: "Identity verification (KYC) ensures that only real, consenting individuals can contribute their likeness. This protects you from impersonation and protects the integrity of our dataset.",
  },
  {
    q: "Is my data safe?",
    a: "All data is stored securely with enterprise-grade encryption. Your photos are kept in private storage buckets with strict access controls. Identity verification is handled by Sumsub, a regulated provider — we never see or store your ID documents. We'll always tell you what we store and why.",
  },
  {
    q: "What's the difference between SFW and NSFW tracks?",
    a: "The Lifestyle (SFW) track is for general modeling and influencer content. The Premium (NSFW) track is for adult-oriented AI content on age-verified platforms. No judgment either way — both tracks are equally valued and receive the same identity protection and security.",
  },
  {
    q: "What happens to my photos after I contribute?",
    a: "Your photos are stored in encrypted cloud storage, then fed into our AI training pipeline. They are never published, displayed publicly, or shared as-is. The AI model learns patterns from your photos to generate new synthetic images — your original files stay locked in storage and are only accessed by our training systems.",
  },
];

export function FAQ() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold text-center mb-4">
          Frequently Asked <span className="text-neon">Questions</span>
        </h2>
        <p className="text-muted-foreground text-center mb-8 sm:mb-12">
          Everything you need to know before getting started.
        </p>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border border-border/50 rounded-xl px-4 sm:px-6 data-[state=open]:bg-card/50"
            >
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline hover:text-neon py-5">
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
