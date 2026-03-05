"use client";

import Link from "next/link";
import { Scale, Shield, Newspaper } from "lucide-react";
import { InquiryDialogTrigger } from "@/components/landing/v2/inquiry-dialog";

export function InvestigationCTA() {
  return (
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Attorneys */}
        <div className="bg-card border border-border rounded-2xl p-6 card-hover flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">For Attorneys</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Need forensic evidence for litigation?
          </p>
          <InquiryDialogTrigger className="mt-auto inline-flex items-center justify-center text-xs font-medium bg-primary text-white px-4 py-2 rounded-full hover:bg-primary/90 transition-colors">
            Request Evidence Package
          </InquiryDialogTrigger>
        </div>

        {/* Individuals */}
        <div className="bg-card border border-border rounded-2xl p-6 card-hover flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">For Individuals</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Is your likeness being used without consent?
          </p>
          <Link
            href="/signup"
            className="mt-auto inline-flex items-center justify-center text-xs font-medium bg-primary text-white px-4 py-2 rounded-full hover:bg-primary/90 transition-colors"
          >
            Protect Your Likeness
          </Link>
        </div>

        {/* Media */}
        <div className="bg-card border border-border rounded-2xl p-6 card-hover flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">For Media</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Want to license this investigation?
          </p>
          <InquiryDialogTrigger className="mt-auto inline-flex items-center justify-center text-xs font-medium bg-primary text-white px-4 py-2 rounded-full hover:bg-primary/90 transition-colors">
            Media Inquiries
          </InquiryDialogTrigger>
        </div>
      </div>
    </section>
  );
}
