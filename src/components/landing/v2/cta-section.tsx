import Link from "next/link";
import { InquiryDialogTrigger } from "./inquiry-dialog";

export function CTASection() {
  return (
    <section id="pricing" className="bg-[#0C1424] text-white">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-24 md:py-28 text-center">
        <h2 className="font-heading text-[clamp(32px,3.5vw,48px)] font-normal tracking-[-0.8px] leading-[1.15] mb-5">
          Deepfake cases need evidence
          <br />
          that <em className="italic text-[#DC2626]">explains itself.</em>
        </h2>
        <p className="text-[17px] text-white/60 max-w-[520px] mx-auto leading-[1.65] mb-9">
          Tell us about the case. We&apos;ll assess what forensic evidence is
          needed and whether we can help build it.
        </p>
        <div className="flex gap-4 justify-center max-sm:flex-col max-sm:items-stretch max-sm:px-4">
          <InquiryDialogTrigger className="inline-flex items-center justify-center px-9 py-4 bg-[#DC2626] text-white rounded-[10px] font-bold text-[15px] hover:opacity-90 hover:-translate-y-0.5 transition-all">
            Discuss a Case
          </InquiryDialogTrigger>
          <Link
            href="/legal-landscape"
            className="inline-flex items-center justify-center px-9 py-4 bg-transparent text-white/60 border border-white/20 rounded-[10px] font-medium text-[15px] hover:border-white/40 hover:text-white transition-all"
          >
            Read the Legal Landscape
          </Link>
        </div>
        <p className="mt-8 text-[14px] text-white/40">
          Contact:{" "}
          <a
            href="mailto:hello@consentedai.com"
            className="text-white/60 hover:text-white transition-colors underline underline-offset-2"
          >
            hello@consentedai.com
          </a>
        </p>
      </div>
    </section>
  );
}
