import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight mb-8 leading-tight">
          AI should be{" "}
          <span className="italic text-primary relative">
            made of us
            <span className="absolute bottom-1 left-0 right-0 h-3 bg-secondary/15 -z-10 rounded-sm" />
          </span>
          ,
          <br />
          not taken from us.
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          The ethical data marketplace where real people contribute their
          likeness, voice, and creativity to train AI — and get paid for it.
          Consent-first. Always.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className="text-base px-8 py-6 rounded-full bg-secondary hover:bg-secondary/90"
          >
            <Link href="/signup">
              Become a Contributor
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="text-base px-8 py-6 rounded-full border-primary text-primary hover:bg-primary/5"
          >
            <Link href="#how-it-works">For Companies</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
