import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { OpportunitySection } from "@/components/landing/opportunity-section";
import { MarketplaceSection } from "@/components/landing/marketplace-section";
import { Pricing } from "@/components/landing/pricing";
import { FinalCTA } from "@/components/landing/final-cta";
import { FAQ } from "@/components/landing/faq";
import { NewFooter } from "@/components/landing/new-footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F0F4FA]">
      <Navbar />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <OpportunitySection />
      <MarketplaceSection />
      <Pricing />
      <FinalCTA />
      <FAQ />
      <NewFooter />
    </main>
  );
}
