import { Hero } from "@/components/landing/hero";
import { ValueProps } from "@/components/landing/value-props";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SocialProof } from "@/components/landing/social-proof";
import { FAQ } from "@/components/landing/faq";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <ValueProps />
      <HowItWorks />
      <SocialProof />
      <FAQ />
      <CTASection />
      <Footer />
    </main>
  );
}
