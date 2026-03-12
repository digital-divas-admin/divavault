import Link from "next/link";

export function NewFooter() {
  return (
    <footer className="py-8 px-4 sm:px-6 border-t border-[#D0D8E6] bg-[#F0F4FA]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Consented AI" className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/claim" className="text-sm text-[#6A80A0] hover:text-[#0C1424] transition-colors">
            Claim Your Face
          </Link>
          <Link href="/developers" className="text-sm text-[#6A80A0] hover:text-[#0C1424] transition-colors">
            Developers
          </Link>
          <p className="text-sm text-[#6A80A0]">
            &copy; 2026 Consented AI, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
