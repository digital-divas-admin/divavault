import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { LiveScanner } from "@/components/landing/live-scanner";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ValueProps } from "@/components/landing/value-props";
import { CompensationFlow } from "@/components/landing/compensation-flow";
import { Pricing } from "@/components/landing/pricing";
import { SocialProof } from "@/components/landing/social-proof";
import { FAQ } from "@/components/landing/faq";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <LiveScanner />
      <HowItWorks />
      <ValueProps />
      <CompensationFlow />
      <Pricing />
      <SocialProof />
      <FAQ />
      <CTASection />
      <Footer />
    </main>
  );
}
