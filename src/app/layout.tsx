import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { Suspense } from "react";
import { SignoutCleanup } from "@/components/auth/signout-cleanup";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Made Of Us | Ethical AI Training on Your Terms",
  description:
    "Contribute your photos to train ethical AI models — on your terms. Made Of Us gives influencers and creators full control, identity protection, and transparent consent.",
  openGraph: {
    title: "Made Of Us | Ethical AI Training on Your Terms",
    description:
      "Contribute your photos to train ethical AI models — with full control over what you share.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${dmSerifDisplay.variable} font-sans antialiased`}
      >
        <Suspense fallback={null}>
          <SignoutCleanup />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
