import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Diva Vault | Ethical AI Training on Your Terms",
  description:
    "Contribute your photos to train ethical AI models — on your terms. Diva Vault gives influencers and creators full control, identity protection, and transparent consent.",
  openGraph: {
    title: "Diva Vault | Ethical AI Training on Your Terms",
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
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
