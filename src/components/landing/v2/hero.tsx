import { EvidenceCard } from "./evidence-card";
import { InquiryDialogTrigger } from "./inquiry-dialog";

export function Hero() {
  return (
    <section className="relative max-w-[1200px] mx-auto min-h-[100vh] flex flex-col justify-center px-6 sm:px-12 pt-36 pb-20">
      {/* Eyebrow */}
      <div
        className="animate-fade-up inline-flex items-center gap-2 text-[13px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-8"
        style={{ opacity: 0, animationDelay: "0.2s" }}
      >
        <span className="w-2 h-2 bg-[#DC2626] rounded-full animate-landing-pulse" />
        Deepfake Forensic Evidence
      </div>

      {/* Headline */}
      <h1
        className="animate-fade-up font-heading text-[clamp(42px,5.5vw,72px)] leading-[1.08] font-normal tracking-[-1.5px] max-w-[800px] mb-7 text-[#0C1424]"
        style={{ opacity: 0, animationDelay: "0.35s" }}
      >
        Court-ready evidence
        <br />
        for <em className="italic text-[#DC2626]">deepfake cases.</em>
      </h1>

      {/* Subtitle */}
      <p
        className="animate-fade-up text-[19px] text-[#3A5070] max-w-[580px] leading-[1.65] mb-12"
        style={{ opacity: 0, animationDelay: "0.5s" }}
      >
        When a deepfake case goes beyond a platform takedown — when your client
        needs to prove it&apos;s AI-generated, prove it&apos;s their face, and
        document who profited — we build the forensic evidence package that holds
        up.
      </p>

      {/* CTAs */}
      <div
        className="animate-fade-up flex gap-4 items-center max-sm:flex-col max-sm:items-stretch"
        style={{ opacity: 0, animationDelay: "0.65s" }}
      >
        <InquiryDialogTrigger className="inline-flex items-center justify-center px-9 py-4 bg-[#DC2626] text-white rounded-[10px] font-bold text-[15px] hover:opacity-90 hover:-translate-y-0.5 transition-all">
          Discuss a Case
        </InquiryDialogTrigger>
        <a
          href="#methodology"
          className="inline-flex items-center justify-center px-9 py-4 bg-transparent text-[#3A5070] border border-[#D0D8E6] rounded-[10px] font-medium text-[15px] hover:border-[#3A5070] hover:text-[#0C1424] transition-all"
        >
          See Our Methodology
        </a>
      </div>

      {/* Floating evidence card (hidden below lg) */}
      <div
        className="animate-fade-in absolute right-0 top-1/2 -translate-y-1/2 w-[380px] hidden lg:block"
        style={{ opacity: 0, animationDelay: "0.9s" }}
      >
        <EvidenceCard
          headerLabel="Evidence Package #2847"
          statusText="Unauthorized Use"
          statusColor="red"
          rows={[
            { label: "Platform", value: "Instagram (Sponsored Ad)" },
            { label: "Facial Match", value: "94.7% Confidence", variant: "match" },
            { label: "AI Classification", value: "97.2% AI-Generated", variant: "match" },
            { label: "Generation Method", value: "Face swap (one-shot)" },
            { label: "Ad Spend Documented", value: "$14,200 (Meta Ad Library)" },
            { label: "Evidence Hash", value: "a3f8c1...e94b", variant: "mono" },
            { label: "Captured", value: "Feb 18, 2026 — Timestamped", variant: "verified" },
          ]}
          footerTags={[
            { text: "Unauthorized", variant: "alert" },
            { text: "Court-Ready", variant: "info" },
          ]}
        />
      </div>
    </section>
  );
}
