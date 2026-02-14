"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  ArrowLeft,
  Menu,
  Shield,
  Users,
  Wallet,
  Radar,
  Target,
  Briefcase,
  ShieldCheck,
  FlaskConical,
  Megaphone,
  Crosshair,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import type { AdminRole } from "@/types/marketplace";
import { AppSwitcher } from "@/components/app-switcher";
import { SignOutButton } from "@/components/auth/signout-button";

const coreNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/requests", label: "Requests", icon: FileText },
  { href: "/admin/review-queue", label: "Review Queue", icon: ClipboardCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/payouts", label: "Payouts", icon: Wallet },
];

const scannerNavItems = [
  { href: "/admin/scanner", label: "Scanner", icon: Radar, exact: true },
  { href: "/admin/scanner/matches", label: "Matches", icon: Target },
  { href: "/admin/scanner/jobs", label: "Scan Jobs", icon: Briefcase },
  { href: "/admin/scanner/test", label: "Testing", icon: FlaskConical },
];

const adIntelNavItems = [
  { href: "/admin/ad-intel", label: "Ad Intelligence", icon: Megaphone, exact: true },
  { href: "/admin/ad-intel/matches", label: "Ad Matches", icon: Crosshair },
  { href: "/admin/ad-intel/jobs", label: "Ad Scan Jobs", icon: Briefcase },
];

const roleLabels: Record<AdminRole, string> = {
  reviewer: "Reviewer",
  admin: "Admin",
  super_admin: "Super Admin",
};

const roleBadgeStyles: Record<AdminRole, string> = {
  reviewer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  admin: "bg-primary/10 text-primary border-primary/20",
  super_admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

interface AdminSidebarProps {
  displayName: string;
  role: AdminRole;
}

function SidebarContent({ displayName, role }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border/30 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground text-lg">madeofus</span>
          <span className="text-xs text-muted-foreground">admin</span>
        </Link>
        <AppSwitcher />
      </div>

      {/* Admin card */}
      <div className="px-4 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                className={`text-[10px] px-1.5 py-0 h-4 ${roleBadgeStyles[role]}`}
              >
                <Shield className="h-2.5 w-2.5 mr-0.5" />
                {roleLabels[role]}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {coreNavItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[14px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-3 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Scanner
          </p>
        </div>

        {scannerNavItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[14px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-3 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Ad Intelligence
          </p>
        </div>

        {adIntelNavItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[14px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-border/30 space-y-2">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

export function AdminSidebar(props: AdminSidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[280px] bg-card backdrop-blur-sm border-r border-border/30 z-30">
      <SidebarContent {...props} />
    </aside>
  );
}

export function AdminMobileHeader(props: AdminSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-sm">
      <Link href="/" className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground text-lg">madeofus</span>
        <span className="text-xs text-muted-foreground">admin</span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          <SidebarContent {...props} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
