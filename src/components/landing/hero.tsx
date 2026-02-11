import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <Badge variant="purple" className="mb-6 px-3 py-1 text-sm">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2" />
          AI likeness protection for everyone
        </Badge>

        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight mb-8 leading-tight">
          Your face is being used{" "}
          <span className="text-primary">without your permission.</span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          AI tools are generating content with real people&apos;s faces — scraped
          from social media, used without consent, and impossible to track. Until now.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className="text-base px-8 py-6 rounded-full"
          >
            <Link href="/signup">
              Protect My Face
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="text-base px-8 py-6 rounded-full border-foreground/20 text-foreground hover:bg-foreground/5"
          >
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
