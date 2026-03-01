"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { InquiryDialogTrigger } from "@/components/landing/v2/inquiry-dialog";

const navLinks = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#clients", label: "Who We Serve" },
  { href: "/legal-landscape", label: "Legal" },
  { href: "/developers", label: "Developers" },
  { href: "/login", label: "Sign In" },
];

export function Navbar({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  if (variant === "dark") {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            <span className="text-foreground">consented</span>
            <span className="text-[#DC2626]">ai</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:block">
            <InquiryDialogTrigger />
          </div>

          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-background border-b border-border/50 px-4 pb-4">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2">
                <InquiryDialogTrigger />
              </div>
            </div>
          </div>
        )}
      </nav>
    );
  }

  // Light variant
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F0F4FA]/80 backdrop-blur-md border-b border-[#D0D8E6]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          <span className="text-[#0C1424]">consented</span>
          <span className="text-[#DC2626]">ai</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[#3A5070] hover:text-[#0C1424] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:block">
          <InquiryDialogTrigger />
        </div>

        <button
          className="md:hidden p-2 text-[#0C1424]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#F0F4FA] border-b border-[#D0D8E6]/50 px-4 pb-4">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[#3A5070] hover:text-[#0C1424] transition-colors py-1"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2">
              <InquiryDialogTrigger />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
