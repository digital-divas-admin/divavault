"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ImageIcon,
  DollarSign,
  ShoppingBag,
  Shield,
  User,
  HelpCircle,
  LogOut,
  Menu,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useDashboardStore } from "@/stores/dashboard-store";
import { AppSwitcher } from "@/components/app-switcher";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contributions", label: "My Contributions", icon: ImageIcon },
  { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/dashboard/privacy", label: "Privacy & Data", icon: Shield },
  { href: "/dashboard/account", label: "Account", icon: User },
  { href: "/dashboard/help", label: "Help & Support", icon: HelpCircle },
];

interface SidebarProps {
  userName: string;
  verified: boolean;
}

function SidebarContent({ userName, verified }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border/30 flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-heading)] text-2xl italic"
        >
          <span className="text-primary">made of </span>
          <span className="text-secondary">us</span>
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
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                Lifestyle
              </Badge>
              {verified && (
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-500 border-green-500/20">
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
          Your data is encrypted & protected
        </p>
        <form action="/api/auth/signout" method="post">
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[280px] bg-card backdrop-blur-sm border-r border-border/30 z-30">
      <SidebarContent {...props} />
    </aside>
  );
}

export function MobileHeader(props: SidebarProps) {
  const { sidebarOpen, setSidebarOpen } = useDashboardStore();

  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-sm">
      <Link
        href="/"
        className="font-[family-name:var(--font-heading)] text-2xl italic"
      >
        <span className="text-primary">made of </span>
        <span className="text-secondary">us</span>
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
