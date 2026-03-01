import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Consented AI",
  description:
    "Create your Consented AI account. Protect your likeness from unauthorized deepfakes with court-ready forensic evidence and automated takedowns.",
  openGraph: {
    title: "Sign Up | Consented AI",
    description:
      "Protect your likeness from unauthorized deepfakes. Sign up for court-ready forensic evidence.",
    type: "website",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
