import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In | Consented AI",
  description:
    "Log in to your Consented AI account to monitor deepfake matches, manage evidence packages, and track takedown progress.",
  openGraph: {
    title: "Log In | Consented AI",
    description:
      "Access your Consented AI dashboard to monitor deepfake matches and manage evidence.",
    type: "website",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
