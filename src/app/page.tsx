import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/v2/hero";
import { StatBar } from "@/components/landing/v2/stat-bar";
import { EvidencePackage } from "@/components/landing/v2/evidence-package";
import { Methodology } from "@/components/landing/v2/methodology";
import { DomainKnowledge } from "@/components/landing/v2/domain-knowledge";
import { WhoWeServe } from "@/components/landing/v2/who-we-serve";
import { LegalLandscapeTeaser } from "@/components/landing/v2/legal-landscape-teaser";
import { AdditionalCapabilities } from "@/components/landing/v2/additional-capabilities";
import { CTASection } from "@/components/landing/v2/cta-section";
import { Footer } from "@/components/landing/v2/footer";
import { InquiryDialogProvider, InquiryDialogContent } from "@/components/landing/v2/inquiry-dialog";

export default function Home() {
  return (
    <InquiryDialogProvider>
      <main className="min-h-screen bg-[#F0F4FA]">
        <Navbar />
        <Hero />
        <StatBar />
        <EvidencePackage />
        <Methodology />
        <DomainKnowledge />
        <WhoWeServe />
        <LegalLandscapeTeaser />
        <AdditionalCapabilities />
        <CTASection />
        <Footer />
      </main>
      <InquiryDialogContent />
    </InquiryDialogProvider>
  );
}
