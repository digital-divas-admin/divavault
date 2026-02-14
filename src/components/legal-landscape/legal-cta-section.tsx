import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bell } from "lucide-react";

export function LegalCTASection() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 bg-primary">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl text-primary-foreground mb-6">
          Your face, your rights
        </h2>
        <p className="text-lg text-primary-foreground/80 mb-8 sm:mb-10 max-w-xl mx-auto">
          Join the movement to protect creative identities from unauthorized AI
          use.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="text-base px-8 py-5 rounded-full bg-white text-primary hover:bg-white/90"
          >
            <Link href="/signup">
              Protect My Face
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="text-base px-8 py-5 rounded-full border-white text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="#get-notified">
              Get Notified
              <Bell className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
