import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[150px] sm:w-[500px] sm:h-[300px] rounded-full bg-neon/8 blur-[100px]" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
          Ready to Put Your Photos to{" "}
          <span className="text-neon neon-text">Work</span>?
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-xl mx-auto">
          Join creators who are shaping the future of ethical AI — with full
          control over their data. Takes about 10 minutes.
        </p>
        <Button
          asChild
          size="lg"
          className="neon-glow-strong text-lg px-6 py-4 sm:px-10 sm:py-6 rounded-xl"
        >
          <Link href="/signup">
            Create Your Account
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
