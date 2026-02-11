import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 bg-primary">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl text-primary-foreground mb-6">
          Start protecting your likeness today
        </h2>
        <p className="text-lg text-primary-foreground/80 mb-8 sm:mb-10 max-w-xl mx-auto">
          Join thousands of creators who are taking control of how their face is
          used in AI. Free to start — no credit card required.
        </p>
        <Button
          asChild
          size="lg"
          className="text-base px-8 py-5 rounded-full bg-white text-primary hover:bg-white/90"
        >
          <Link href="/signup">
            Protect My Face
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
