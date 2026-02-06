import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="py-10 px-4 sm:py-12 sm:px-6 border-t border-border/30">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div>
            <Link
              href="/"
              className="font-[family-name:var(--font-heading)] text-xl font-bold"
            >
              <span className="text-neon">diva</span>vault
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              Powered by{" "}
              <span className="text-neon font-medium">vixxxen.ai</span>
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

        <Separator className="bg-border/30" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Diva Vault. All rights reserved.</p>
          <p>
            Every photo shared with consent. Every model trained ethically.
          </p>
        </div>
      </div>
    </footer>
  );
}
