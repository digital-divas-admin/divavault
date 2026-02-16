import Link from "next/link";

export function NewFooter() {
  return (
    <footer className="py-8 px-4 sm:px-6 border-t border-[#D0D8E6] bg-[#F0F4FA]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold">
          <span className="text-[#0C1424]">consented</span>
          <span className="text-[#DC2626]">ai</span>
        </Link>
        <p className="text-sm text-[#6A80A0]">
          &copy; 2026 Consented AI, Inc.
        </p>
      </div>
    </footer>
  );
}
