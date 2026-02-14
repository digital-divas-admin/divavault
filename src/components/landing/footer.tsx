import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-10 px-4 sm:py-12 sm:px-6 bg-card border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span className="font-semibold text-foreground text-xl">madeofus</span>
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              Protecting creators from unauthorized AI use.
            </p>
          </div>

          <nav className="flex flex-wrap justify-center md:justify-start gap-4 sm:gap-6 text-sm text-muted-foreground">
            <Link
              href="#how-it-works"
              className="hover:text-foreground transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#pricing"
              className="hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/legal-landscape"
              className="hover:text-foreground transition-colors"
            >
              Legal Landscape
            </Link>
            <Link
              href="/signup"
              className="hover:text-foreground transition-colors"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="hover:text-foreground transition-colors"
            >
              Log In
            </Link>
          </nav>
        </div>

        <Separator className="bg-border" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Made Of Us. All rights reserved.</p>
          <p>AI likeness protection for everyone.</p>
        </div>
      </div>
    </footer>
  );
}
