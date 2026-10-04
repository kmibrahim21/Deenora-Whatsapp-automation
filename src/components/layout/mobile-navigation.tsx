"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Bell,
  Bot,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AccountRole } from "@/lib/auth/roles";

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; label: string; className: string }
> = {
  owner: {
    icon: Crown,
    label: "মালিক",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    label: "এডমিন",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    label: "এজেন্ট",
    className: "border-border bg-muted text-foreground",
  },
  viewer: {
    icon: User,
    label: "দর্শক",
    className: "border-border bg-card text-muted-foreground",
  },
};

interface MoreMenuItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number | string;
  badgeTone?: "primary" | "amber";
}

export function BottomNavigation() {
  const pathname = usePathname();
  const { profile, accountRole, signOut, hasPermission } = useAuth();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isInboxActive = pathname === "/inbox" || pathname.startsWith("/inbox");
  const isFlowsActive = pathname === "/flows" || pathname.startsWith("/flows");
  const isAiActive = pathname === "/agents" || pathname.startsWith("/agents");
  const isContactsActive =
    pathname === "/contacts" || pathname.startsWith("/contacts");

  // Determine if active route is one of the "More" items
  const isMoreActive =
    !isInboxActive &&
    !isFlowsActive &&
    !isAiActive &&
    !isContactsActive &&
    (pathname === "/dashboard" ||
      pathname.startsWith("/pipelines") ||
      pathname.startsWith("/broadcasts") ||
      pathname.startsWith("/automations") ||
      pathname.startsWith("/notifications") ||
      pathname.startsWith("/settings"));

  const extraNavItems: MoreMenuItem[] = [
    {
      href: "/dashboard",
      label: "ড্যাশবোর্ড",
      icon: LayoutDashboard,
    },
    {
      href: "/pipelines",
      label: "পাইপলাইন ও ডিল",
      icon: GitBranch,
    },
    {
      href: "/broadcasts",
      label: "ব্রডকাস্ট",
      icon: Radio,
    },
    {
      href: "/automations",
      label: "অটোমেশন",
      icon: Zap,
    },
    {
      href: "/notifications",
      label: "নোটিফিকেশন",
      icon: Bell,
      badge: unreadNotifications > 0 ? (unreadNotifications > 9 ? "9+" : unreadNotifications) : undefined,
      badgeTone: "primary",
    },
    {
      href: "/settings",
      label: "সেটিংস",
      icon: Settings,
    },
  ];

  const visibleExtraItems = extraNavItems.filter((item) => {
    const permKey = item.href.replace("/", "");
    return hasPermission(permKey);
  });

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  const roleMeta = accountRole ? ROLE_CHIP[accountRole] : null;
  const RoleIcon = roleMeta?.icon;

  return (
    <>
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 h-16 md:hidden",
          "border-t border-border bg-background/85 backdrop-blur-md",
          "pb-[env(safe-area-inset-bottom,0px)] shadow-lg",
        )}
      >
        <div className="grid h-full grid-cols-5 items-center">
          {/* 1. ইনবক্স */}
          <Link
            href="/inbox"
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 py-1 transition-colors",
              isInboxActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium",
            )}
          >
            <div className="relative">
              <MessageSquare className="size-5" />
              {totalUnread > 0 && !isInboxActive && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              )}
            </div>
            <span className="text-[11px] leading-tight">ইনবক্স</span>
          </Link>

          {/* 2. ফ্লো */}
          <Link
            href="/flows"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 transition-colors",
              isFlowsActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium",
            )}
          >
            <Workflow className="size-5" />
            <span className="text-[11px] leading-tight">ফ্লো</span>
          </Link>

          {/* 3. AI */}
          <Link
            href="/agents"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 transition-colors",
              isAiActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium",
            )}
          >
            <Bot className="size-5" />
            <span className="text-[11px] leading-tight">AI</span>
          </Link>

          {/* 4. কন্টাক্টস */}
          <Link
            href="/contacts"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 transition-colors",
              isContactsActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium",
            )}
          >
            <Users className="size-5" />
            <span className="text-[11px] leading-tight">কন্টাক্টস</span>
          </Link>

          {/* 5. আরও (More Bottom Sheet trigger) */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 py-1 transition-colors",
              isMoreActive || moreOpen
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium",
            )}
            aria-label="আরও মেনু খুলুন"
          >
            <div className="relative">
              <MoreHorizontal className="size-5" />
              {unreadNotifications > 0 && !isMoreActive && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <span className="text-[11px] leading-tight">আরও</span>
          </button>
        </div>
      </nav>

      {/* 'আরও' Bottom Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t border-border bg-card p-0 md:hidden max-h-[85vh] overflow-y-auto"
        >
          {/* Grab Handle */}
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

          <SheetHeader className="px-5 pt-3 pb-2 text-left border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base font-semibold text-foreground">
                  মেনু এবং অপশন
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  অন্যান্য পেজ এবং অ্যাকাউন্ট সেটিংস
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* User profile strip */}
          <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/40 border-b border-border/50">
            <Avatar className="size-10 shrink-0">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile?.full_name ?? "User"} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">
                  {profile?.full_name || "ব্যবহারকারী"}
                </span>
                {roleMeta && RoleIcon ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.2 text-[9px] font-medium",
                      roleMeta.className,
                    )}
                  >
                    <RoleIcon className="size-2.5" />
                    {roleMeta.label}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.email || ""}
              </p>
            </div>
          </div>

          {/* Grid of extra navigation links */}
          <div className="p-4 grid grid-cols-2 gap-2.5">
            {visibleExtraItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-all",
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                      : "border-border bg-card hover:bg-muted/60 text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-medium">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="p-4 pt-0 flex gap-2">
            <Link
              href="/settings?tab=profile"
              onClick={() => setMoreOpen(false)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 py-2.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <User className="size-3.5" />
              প্রোফাইল
            </Link>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                void signOut();
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              <LogOut className="size-3.5" />
              লগআউট
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
