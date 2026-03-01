import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, Outfit, DM_Mono } from "next/font/google";
import { Suspense } from "react";
import { SignoutCleanup } from "@/components/auth/signout-cleanup";
import "@/lib/env";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Consented AI | AI Likeness Protection",
  description:
    "Protect your face from unauthorized AI use. Consented AI scans AI platforms for your likeness, files takedowns, and keeps you in control.",
  openGraph: {
    title: "Consented AI | AI Likeness Protection",
    description:
      "Protect your face from unauthorized AI use. We scan 247+ platforms and file takedowns automatically.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${instrumentSerif.variable} ${outfit.variable} ${dmMono.variable} font-sans antialiased`}
      >
        <Suspense fallback={null}>
          <SignoutCleanup />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
