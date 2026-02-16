import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MiniScanner } from "./mini-scanner";

export function Hero() {
  return (
    <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <span className="inline-block font-[family-name:var(--font-mono)] text-[10px] sm:text-xs font-medium uppercase tracking-widest text-[#DC2626] bg-[#DC2626]/10 px-3 py-1.5 rounded-full mb-6">
              AI Likeness Protection
            </span>

            <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl md:text-6xl tracking-tight mb-6 leading-tight text-[#0C1424]">
              Your face is being used without your{" "}
              <em className="not-italic text-[#DC2626]">permission</em>.
            </h1>

            <p className="font-[family-name:var(--font-outfit)] text-lg text-[#3A5070] max-w-lg mb-8 leading-relaxed">
              AI tools are generating content with real people&apos;s faces — scraped
              from social media, used without consent, and impossible to track. Until now.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 bg-[#DC2626] text-white font-medium px-8 py-3 rounded-full hover:bg-[#EF4444] transition-colors text-base"
              >
                Protect My Face
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 border border-[#D0D8E6] text-[#3A5070] font-medium px-8 py-3 rounded-full hover:bg-[#DEE6F2]/50 transition-colors text-base"
              >
                See how it works
              </Link>
            </div>
          </div>

          {/* Right: mini scanner */}
          <div>
            <MiniScanner />
          </div>
        </div>
      </div>
    </section>
  );
}
