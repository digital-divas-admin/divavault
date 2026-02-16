"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Target,
  ImageIcon,
  User,
  HelpCircle,
  Menu,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useDashboardStore } from "@/stores/dashboard-store";
import { AppSwitcher } from "@/components/app-switcher";
import { SignOutButton } from "@/components/auth/signout-button";
import type { SubscriptionTier } from "@/types/protection";

const navItems = [
  { href: "/dashboard", label: "Protection Overview", icon: ShieldCheck, exact: true },
  { href: "/dashboard/matches", label: "Matches", icon: Target },
  { href: "/dashboard/your-data", label: "Your Data", icon: ImageIcon },
  { href: "/dashboard/account", label: "Account", icon: User },
  { href: "/dashboard/help", label: "Help & Support", icon: HelpCircle },
];

const tierLabels: Record<SubscriptionTier, string> = {
  free: "Free",
  protected: "Protected",
  premium: "Premium",
};

interface SidebarProps {
  userName: string;
  verified: boolean;
  tier?: SubscriptionTier;
  platformsMonitored?: number;
}

function SidebarContent({ userName, verified, tier = "free", platformsMonitored = 0 }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const initials = (userName || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border/30 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground text-lg">consented<span className="text-primary">ai</span></span>
        </Link>
        <AppSwitcher />
      </div>

      {/* User card */}
      <div className="px-4 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{userName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant="primary"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {tierLabels[tier]}
              </Badge>
              {verified && (
                <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">
                  Verified
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map((item) => {
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
      <div className="px-4 py-4 border-t border-border/30 space-y-3">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          Actively monitoring {platformsMonitored} platform{platformsMonitored !== 1 ? "s" : ""}
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[280px] bg-sidebar backdrop-blur-sm border-r border-border/30 z-30">
      <SidebarContent {...props} />
    </aside>
  );
}

export function MobileHeader(props: SidebarProps) {
  const { sidebarOpen, setSidebarOpen } = useDashboardStore();

  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-sm">
      <Link href="/" className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground text-lg">consented<span className="text-primary">ai</span></span>
      </Link>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <SidebarContent {...props} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
