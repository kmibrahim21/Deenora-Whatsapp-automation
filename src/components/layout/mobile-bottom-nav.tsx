"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  MessageSquare,
  Workflow,
  Sparkles,
  Users,
  MoreHorizontal,
  Zap,
  GitBranch,
  FileText,
  Radio,
  BookOpen,
  LayoutDashboard,
  Bell,
  Settings,
  UsersRound,
  LogOut,
  X,
  ChevronRight,
  Shield,
  Crown,
  UserCog,
  User,
} from "lucide-react";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TabItem {
  id: string;
  label: string;
  href: string;
  icon: typeof MessageSquare;
  isMore?: boolean;
}

const PRIMARY_TABS: TabItem[] = [
  { id: "inbox", label: "ইনবক্স", href: "/inbox", icon: MessageSquare },
  { id: "flows", label: "ফ্লো", href: "/flows", icon: Workflow },
  { id: "agents", label: "AI", href: "/agents", icon: Sparkles },
  { id: "contacts", label: "কন্টাক্টস", href: "/contacts", icon: Users },
  { id: "more", label: "আরও", href: "#more", icon: MoreHorizontal, isMore: true },
];

interface MoreSheetItem {
  label: string;
  sublabel: string;
  href: string;
  icon: typeof Zap;
  badge?: string | number | null;
  permission?: string;
}

const MORE_ITEMS: MoreSheetItem[] = [
  {
    label: "ড্যাশবোর্ড",
    sublabel: "ওভারভিউ ও অ্যানালিটিক্স",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
  },
  {
    label: "অটোমেশন",
    sublabel: "অটোমেশন রুলস ও ট্রিগার",
    href: "/automations",
    icon: Zap,
    permission: "automations",
  },
  {
    label: "ডিলস / পাইপলাইন",
    sublabel: "সেলস পাইপলাইন ও স্টেজ",
    href: "/pipelines",
    icon: GitBranch,
    permission: "pipelines",
  },
  {
    label: "ব্রডকাস্ট",
    sublabel: "বাল্ক ক্যাম্পেইন মেসেজিং",
    href: "/broadcasts",
    icon: Radio,
    permission: "broadcasts",
  },
  {
    label: "টেমপ্লেট",
    sublabel: "হোয়াটসঅ্যাপ মেসেজ টেমপ্লেটস",
    href: "/settings?tab=templates",
    icon: FileText,
    permission: "settings",
  },
  {
    label: "নলেজ বেস",
    sublabel: "AI প্রম্পট ও ট্রেনিং ডাটা",
    href: "/agents?tab=setup",
    icon: BookOpen,
    permission: "agents",
  },
  {
    label: "নোটিফিকেশন",
    sublabel: "সিস্টেম অ্যালার্টস ও আপডেট",
    href: "/notifications",
    icon: Bell,
    permission: "notifications",
  },
  {
    label: "টিম মেম্বার",
    sublabel: "রোলস ও পারমিশন কন্ট্রোল",
    href: "/settings?tab=members",
    icon: UsersRound,
    permission: "settings",
  },
  {
    label: "সেটিংস",
    sublabel: "অ্যাকাউন্ট ও ইন্টিগ্রেশন",
    href: "/settings",
    icon: Settings,
    permission: "settings",
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  const { profile, accountRole, signOut, hasPermission } = useAuth();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const lastScrollY = useRef(0);

  // Close more sheet on navigation
  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  // Handle on-screen keyboard detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleViewportResize = () => {
      if (!window.visualViewport) return;
      const heightRatio = window.visualViewport.height / window.innerHeight;
      if (heightRatio < 0.78) {
        setIsKeyboardOpen(true);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        if (window.innerWidth <= 768) {
          setIsKeyboardOpen(true);
        }
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (
          !active ||
          (active.tagName !== "INPUT" &&
            active.tagName !== "TEXTAREA" &&
            !active.isContentEditable)
        ) {
          setIsKeyboardOpen(false);
        }
      }, 120);
    };

    window.visualViewport?.addEventListener("resize", handleViewportResize);
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  // Smart scroll hide for long lists
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      // Keep always visible on inbox conversation screen
      if (pathname.startsWith("/inbox")) {
        setIsScrolledDown(false);
        return;
      }

      const mainElem = document.querySelector("main");
      const currentScrollY = mainElem ? mainElem.scrollTop : window.scrollY || 0;

      if (currentScrollY > lastScrollY.current + 30 && currentScrollY > 80) {
        setIsScrolledDown(true);
      } else if (currentScrollY < lastScrollY.current - 15) {
        setIsScrolledDown(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const mainElem = document.querySelector("main");
    mainElem?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      mainElem?.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  // Scroll to top when tapping already-active tab
  const handleTabClick = (tab: TabItem, e: React.MouseEvent) => {
    if (tab.isMore) {
      e.preventDefault();
      setIsMoreOpen((prev) => !prev);
      return;
    }

    if (pathname === tab.href || pathname.startsWith(tab.href + "/")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const mainElem = document.querySelector("main");
      if (mainElem) mainElem.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Determine if active tab is one of the more items
  const isMoreActive =
    isMoreOpen ||
    MORE_ITEMS.some((item) => {
      const baseHref = item.href.split("?")[0];
      return pathname === baseHref || (baseHref !== "/dashboard" && pathname.startsWith(baseHref));
    });

  const shouldHideBar = isKeyboardOpen || (isScrolledDown && !isMoreOpen);

  // Filter allowed items for the More bottom sheet
  const visibleMoreItems = MORE_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  }).map((item) => {
    if (item.href === "/notifications" && unreadNotifications > 0) {
      return { ...item, badge: unreadNotifications > 9 ? "9+" : unreadNotifications };
    }
    return item;
  });

  const userInitial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <>
      {/* Fixed Mobile Bottom Navigation Bar (≤768px only) */}
      <nav
        aria-label="Mobile Navigation"
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 md:hidden",
          "h-16 pb-[env(safe-area-inset-bottom,0px)]",
          "border-t border-border bg-card/95 backdrop-blur-lg shadow-2xl",
          "transition-transform duration-300 ease-out will-change-transform",
          "[-webkit-tap-highlight-color:transparent]",
          shouldHideBar ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100",
        )}
      >
        <div className="grid grid-cols-5 h-full items-center px-1">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            let isActive = false;

            if (tab.isMore) {
              isActive = isMoreActive;
            } else if (tab.href === "/inbox") {
              isActive = pathname.startsWith("/inbox");
            } else if (tab.href === "/dashboard") {
              isActive = pathname === "/dashboard";
            } else {
              isActive = pathname === tab.href || pathname.startsWith(tab.href);
            }

            return (
              <Link
                key={tab.id}
                href={tab.href}
                onClick={(e) => handleTabClick(tab, e)}
                className={cn(
                  "relative flex flex-col items-center justify-center h-full min-h-[48px] py-1.5 px-0.5",
                  "text-center select-none transition-all duration-150 active:scale-[0.94]",
                  isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Active Indicator Bar at Top */}
                {isActive && (
                  <span className="absolute top-0 inset-x-0 mx-auto h-0.5 w-7 rounded-full bg-primary" />
                )}

                {/* Tab Icon with Badge */}
                <div className="relative flex items-center justify-center">
                  <Icon className="size-[22px] transition-transform" strokeWidth={1.8} />

                  {/* Unread Badge on Inbox */}
                  {tab.id === "inbox" && totalUnread > 0 && (
                    <span
                      aria-label={`${totalUnread} unread conversations`}
                      className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm animate-in zoom-in-50"
                    >
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </div>

                {/* 11px Bengali Label */}
                <span
                  className={cn(
                    "text-[11px] font-medium leading-none mt-1 tracking-tight truncate max-w-full",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* "আরও" (More) Bottom Sheet */}
      <AnimatePresence>
        {isMoreOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
            {/* Scrim / Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMoreOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Sliding Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setIsMoreOpen(false);
                }
              }}
              className="relative w-full max-h-[85vh] rounded-t-[20px] border-t border-border bg-card shadow-2xl flex flex-col overflow-hidden pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Sheet Header */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MoreHorizontal className="size-4" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">আরও অপশন</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Sheet Content Scrollable List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {visibleMoreItems.map((item) => {
                  const Icon = item.icon;
                  const isItemActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href.split("?")[0]));

                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        router.push(item.href);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3.5 p-3 rounded-xl text-left",
                        "border border-transparent transition-all duration-150 active:scale-[0.98]",
                        "[-webkit-tap-highlight-color:transparent]",
                        isItemActive
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "hover:bg-muted/60 text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-xl",
                            isItemActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="size-5" strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{item.label}</span>
                            {item.badge && (
                              <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground leading-none">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate block">
                            {item.sublabel}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}

                {/* User Account Strip & Sign Out */}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="size-9 shrink-0">
                        {profile?.avatar_url ? (
                          <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? "User"} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {profile?.full_name || profile?.email || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        signOut();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
                    >
                      <LogOut className="size-3.5" />
                      <span>লগআউট</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
