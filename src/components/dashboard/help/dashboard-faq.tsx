import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqItems = [
  {
    question: "How are my photos used in AI training?",
    answer:
      "Your photos are used to train AI models that generate synthetic images. The models learn visual patterns from your photos — things like lighting, poses, and features — to create new, original images. Your actual photos are never published or shared directly.",
  },
  {
    question: "Can I remove my photos after contributing?",
    answer:
      "Yes. Go to My Contributions and remove any photo you want. Removed photos won't be used in future training batches. However, models that have already been trained cannot be un-trained — this is a limitation of current AI technology.",
  },
  {
    question: "When will I start earning?",
    answer:
      "We're building the compensation system now. As a founding contributor, you'll be first in line when it launches. We'll notify you by email as soon as earnings become available.",
  },
  {
    question: "What does 'opting out' mean?",
    answer:
      "Opting out means your photos will no longer be included in any future AI training batches. Your photos remain in storage but are flagged as inactive. You can opt back in at any time from Privacy & Data.",
  },
  {
    question: "Is my identity information stored?",
    answer:
      "Your ID verification is processed by Sumsub, a trusted third-party KYC provider. We never store your ID documents directly — only the verification status (verified/not verified) is kept in our system.",
  },
  {
    question: "What happens if I delete my account?",
    answer:
      "Account deletion has a 30-day cooling period. After that, all your data is permanently removed: profile, uploaded photos, consent records, and activity history. Models that were already trained with your photos cannot be retroactively modified.",
  },
  {
    question: "How do I change my email or password?",
    answer:
      "Email changes are not currently supported. For password changes, use the forgot password flow from the login page. Two-factor authentication is coming soon.",
  },
  {
    question: "Can I switch between SFW and NSFW tracks?",
    answer:
      "Track changes require re-verification and new consent. Please contact support if you need to switch tracks.",
  },
];

export function DashboardFaq() {
  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
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
