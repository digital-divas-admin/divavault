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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: "Consented AI",
                url: "https://www.consentedai.com",
                description:
                  "Court-ready forensic evidence for deepfake cases. Documented, explainable evidence packages for attorneys, talent management, and content removal firms.",
                contactPoint: {
                  "@type": "ContactPoint",
                  email: "info@consentedai.com",
                  contactType: "sales",
                },
              },
              {
                "@type": "WebSite",
                url: "https://www.consentedai.com",
                name: "Consented AI",
                description:
                  "Court-ready forensic evidence for deepfake cases.",
              },
              {
                "@type": "ProfessionalService",
                name: "Deepfake Forensic Evidence",
                provider: {
                  "@type": "Organization",
                  name: "Consented AI",
                },
                description:
                  "We build documented, explainable evidence packages for deepfake cases that hold up in court. Our methodology covers detection, attribution, and chain-of-custody documentation.",
                serviceType: "Deepfake Forensic Analysis",
                areaServed: "US",
              },
            ],
          }),
        }}
      />
    </InquiryDialogProvider>
  );
}
