import { Navbar } from "@/components/landing/navbar";

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar variant="dark" />
      <main className="pt-16 min-h-screen bg-background">
        {children}
      </main>
    </>
  );
}
