import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 bg-[#0C1424]">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl text-white mb-6 leading-tight">
          Take control of your likeness. It takes 10 minutes.
        </h2>
        <p className="font-[family-name:var(--font-outfit)] text-[#6A80A0] text-lg mb-8 sm:mb-10 max-w-xl mx-auto">
          Join thousands of people protecting their face from unauthorized AI use. Free to start.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-[#DC2626] text-white font-medium px-8 py-3 rounded-full hover:bg-[#EF4444] transition-colors text-base"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-medium px-8 py-3 rounded-full hover:bg-white/5 transition-colors text-base"
          >
            Learn More
          </Link>
        </div>
      </div>
    </section>
  );
}
