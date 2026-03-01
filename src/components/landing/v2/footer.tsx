import Link from "next/link";

export function Footer() {
  return (
    <footer className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10 border-t border-[#D0D8E6] flex flex-col sm:flex-row justify-between items-center gap-4 text-[13px] text-[#3A5070]">
      <span>&copy; 2026 Consented AI, Inc.</span>
      <div className="flex gap-6">
        <Link
          href="/legal-landscape"
          className="hover:text-[#0C1424] transition-colors"
        >
          Legal Landscape
        </Link>
        <a
          href="mailto:hello@consentedai.com"
          className="hover:text-[#0C1424] transition-colors"
        >
          Contact
        </a>
      </div>
    </footer>
  );
}
