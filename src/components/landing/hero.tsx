import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[80vh] sm:min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] rounded-full bg-neon/5 blur-[120px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neon/20 bg-neon/5 text-neon text-sm mb-8">
          <Sparkles className="w-4 h-4" />
          <span>Early access — join creators building ethical AI</span>
        </div>

        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
          Your Image.{" "}
          <span className="text-neon neon-text">Your Terms.</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
          Contribute your photos to train ethical AI models — on your terms.
          Full control over what you share, identity protection built in, and
          compensation when our payment system launches.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className="neon-glow text-lg px-6 py-4 sm:px-8 sm:py-6 rounded-xl"
          >
            <Link href="/signup">
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="text-lg px-6 py-4 sm:px-8 sm:py-6 rounded-xl border-border/50"
          >
            <Link href="#how-it-works">Learn More</Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          No credit card needed. You choose what to share. Opt out anytime.
        </p>
        <p className="mt-2 text-xs text-trust-muted">
          Your photos are stored encrypted and never shared publicly.
        </p>
      </div>
    </section>
  );
}
