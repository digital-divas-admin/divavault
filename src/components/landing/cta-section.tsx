import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 bg-primary">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl text-primary-foreground mb-6">
          Ready to Put Your Photos to Work?
        </h2>
        <p className="text-lg text-primary-foreground/80 mb-8 sm:mb-10 max-w-xl mx-auto">
          Join creators who are shaping the future of ethical AI — with full
          control over their data. Takes about 10 minutes.
        </p>
        <Button
          asChild
          size="lg"
          variant="secondary"
          className="text-base px-8 py-5 rounded-xl bg-white text-primary hover:bg-white/90"
        >
          <Link href="/signup">
            Create Your Account
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
