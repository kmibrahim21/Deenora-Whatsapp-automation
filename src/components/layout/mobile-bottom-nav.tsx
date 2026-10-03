"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Workflow,
  Sparkles,
  Users,
  MoreHorizontal,
  Zap,
  GitBranch,
  LayoutGrid,
  Radio,
  BookOpen,
  Settings,
  UsersRound,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTotalUnread } from "@/hooks/use-total-unread";

interface MoreItem {
  title: string;
  subtitle: string;
  href: string;
  icon: typeof Zap;
  match: (pathname: string, tab: string | null) => boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const totalUnread = useTotalUnread();

  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isHiddenByScroll, setIsHiddenByScroll] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const lastScrollY = useRef(0);
  const currentTabParam = searchParams.get("tab");

  // Secondary items for the "আরও" bottom sheet
  const moreItems: MoreItem[] = [
    {
      title: "অটোমেশন",
      subtitle: "স্বয়ংক্রিয় মেসেজ ও ট্র্রিগার রুলস",
      href: "/automations",
      icon: Zap,
      match: (p) => p.startsWith("/automations"),
    },
    {
      title: "ডিলস / পাইপলাইন",
      subtitle: "কাস্টমার পাইপলাইন ও সেলস ট্র্যাকিং",
      href: "/pipelines",
      icon: GitBranch,
      match: (p) => p.startsWith("/pipelines"),
    },
    {
      title: "টেমপ্লেট",
      subtitle: "মেটা অনুমোদিত মেসেজ টেমপ্লেটস",
      href: "/settings?tab=templates",
      icon: LayoutGrid,
      match: (p, tab) => p.startsWith("/settings") && tab === "templates",
    },
    {
      title: "ব্রডকাস্ট",
      subtitle: "বাল্ক মেসেজ ও ক্যাম্পেইন ম্যানেজার",
      href: "/broadcasts",
      icon: Radio,
      match: (p) => p.startsWith("/broadcasts"),
    },
    {
      title: "নলেজ বেস",
      subtitle: "AI ট্রেনিং ডাটা ও ডকুমেন্টেশন",
      href: "/settings?tab=ai",
      icon: BookOpen,
      match: (p, tab) => p.startsWith("/settings") && tab === "ai",
    },
    {
      title: "টিম মেম্বার",
      subtitle: "রোল, পারমিশন ও মেম্বার তালিকা",
      href: "/settings?tab=members",
      icon: UsersRound,
      match: (p, tab) => p.startsWith("/settings") && tab === "members",
    },
    {
      title: "সেটিংস",
      subtitle: "হোয়াটসঅ্যাপ, একাউন্ট ও জেনারেল কনফিগারেশন",
      href: "/settings",
      icon: Settings,
      match: (p, tab) => p.startsWith("/settings") && !tab,
    },
  ];

  // Active state matching for the 5 main tabs
  const isInboxActive = pathname === "/inbox" || pathname.startsWith("/inbox");
  const isFlowsActive = pathname === "/flows" || pathname.startsWith("/flows");
  const isAgentsActive = pathname === "/agents" || pathname.startsWith("/agents");
  const isContactsActive = pathname === "/contacts" || pathname.startsWith("/contacts");

  // "আরও" is active if any of the sub-items are currently active
  const isMoreActive =
    moreSheetOpen ||
    moreItems.some((item) => item.match(pathname, currentTabParam)) ||
    pathname.startsWith("/notifications");

  // 1. Detect on-screen virtual keyboard open/close
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      // Small timeout to allow focus switching between inputs without flicker
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
      }, 100);
    };

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        // If viewport shrunk by > 150px, keyboard is open
        if (heightDiff > 150) {
          setIsKeyboardOpen(true);
        } else {
          setIsKeyboardOpen(false);
        }
      }
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize);
    }

    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportResize);
      }
    };
  }, []);

  // 2. Detect Fullscreen media viewer
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // 3. Smart hide on scroll for long scrollable lists (Flows, Contacts, etc.)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Inside inbox we keep it accessible unless keyboard is open
    if (pathname.startsWith("/inbox")) {
      setIsHiddenByScroll(false);
      return;
    }

    const scrollContainer =
      document.getElementById("main-content-scroll") || window;

    const handleScroll = () => {
      const currentScrollY =
        scrollContainer === window
          ? window.scrollY
          : (scrollContainer as HTMLElement).scrollTop;

      // Only trigger hide after 60px of top
      if (currentScrollY > 60) {
        if (currentScrollY > lastScrollY.current + 15) {
          // Scrolling down -> hide bar
          setIsHiddenByScroll(true);
        } else if (currentScrollY < lastScrollY.current - 10) {
          // Scrolling up -> show bar
          setIsHiddenByScroll(false);
        }
      } else {
        setIsHiddenByScroll(false);
      }

      lastScrollY.current = Math.max(0, currentScrollY);
    };

    if (scrollContainer === window) {
      window.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      (scrollContainer as HTMLElement).addEventListener("scroll", handleScroll, {
        passive: true,
      });
    }

    return () => {
      if (scrollContainer === window) {
        window.removeEventListener("scroll", handleScroll);
      } else {
        (scrollContainer as HTMLElement)?.removeEventListener(
          "scroll",
          handleScroll,
        );
      }
    };
  }, [pathname]);

  // Scroll to top when tapping already active tab
  const handleTabClick = useCallback(
    (e: React.MouseEvent, href: string, isActive: boolean) => {
      if (isActive) {
        e.preventDefault();
        const mainScroll = document.getElementById("main-content-scroll");
        if (mainScroll) {
          mainScroll.scrollTo({ top: 0, behavior: "smooth" });
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [],
  );

  // Close sheet on route change
  useEffect(() => {
    setMoreSheetOpen(false);
  }, [pathname, searchParams]);

  // Prevent background scroll when bottom sheet is open
  useEffect(() => {
    if (moreSheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreSheetOpen]);

  // Hide bar completely if keyboard or fullscreen is active
  const shouldHideBar = isKeyboardOpen || isFullscreen || isHiddenByScroll;

  return (
    <>
      {/* 5-Item Mobile Bottom Navigation Bar (Screens ≤ 768px) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 md:hidden",
          "h-[64px] pb-[env(safe-area-inset-bottom,0px)]",
          "bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.45)]",
          "transition-all duration-200 ease-out",
          "[-webkit-tap-highlight-color:transparent]",
          shouldHideBar
            ? "translate-y-[120%] opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100",
        )}
      >
        <div className="grid h-full grid-cols-5 items-center px-1">
          {/* 1. ইনবক্স (Inbox) */}
          <Link
            href="/inbox"
            onClick={(e) => handleTabClick(e, "/inbox", isInboxActive)}
            className={cn(
              "group relative flex min-h-[48px] flex-col items-center justify-center gap-1 py-1 text-center transition-all duration-150 active:scale-[0.94] active:opacity-80",
              isInboxActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* Active Indicator Top Dot / Bar */}
            {isInboxActive && (
              <span className="absolute top-0.5 h-0.5 w-6 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-150" />
            )}

            <div className="relative">
              <MessageSquare className="size-[22px]" strokeWidth={1.8} />

              {/* Unread Pill Badge (Max 99+) */}
              {totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread}টি অপঠিত মেসেজ`}
                  className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-card"
                >
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>

            <span className="text-[11px] font-medium leading-none tracking-tight">
              ইনবক্স
            </span>
          </Link>

          {/* 2. ফ্লো (Flows) */}
          <Link
            href="/flows"
            onClick={(e) => handleTabClick(e, "/flows", isFlowsActive)}
            className={cn(
              "group relative flex min-h-[48px] flex-col items-center justify-center gap-1 py-1 text-center transition-all duration-150 active:scale-[0.94] active:opacity-80",
              isFlowsActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isFlowsActive && (
              <span className="absolute top-0.5 h-0.5 w-6 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-150" />
            )}
            <Workflow className="size-[22px]" strokeWidth={1.8} />
            <span className="text-[11px] font-medium leading-none tracking-tight">
              ফ্লো
            </span>
          </Link>

          {/* 3. AI (AI Agents) */}
          <Link
            href="/agents"
            onClick={(e) => handleTabClick(e, "/agents", isAgentsActive)}
            className={cn(
              "group relative flex min-h-[48px] flex-col items-center justify-center gap-1 py-1 text-center transition-all duration-150 active:scale-[0.94] active:opacity-80",
              isAgentsActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isAgentsActive && (
              <span className="absolute top-0.5 h-0.5 w-6 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-150" />
            )}
            <Sparkles className="size-[22px]" strokeWidth={1.8} />
            <span className="text-[11px] font-medium leading-none tracking-tight">
              AI
            </span>
          </Link>

          {/* 4. কন্টাক্টস (Contacts) */}
          <Link
            href="/contacts"
            onClick={(e) => handleTabClick(e, "/contacts", isContactsActive)}
            className={cn(
              "group relative flex min-h-[48px] flex-col items-center justify-center gap-1 py-1 text-center transition-all duration-150 active:scale-[0.94] active:opacity-80",
              isContactsActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isContactsActive && (
              <span className="absolute top-0.5 h-0.5 w-6 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-150" />
            )}
            <Users className="size-[22px]" strokeWidth={1.8} />
            <span className="text-[11px] font-medium leading-none tracking-tight">
              কন্টাক্টস
            </span>
          </Link>

          {/* 5. আরও (More Drawer Action) */}
          <button
            type="button"
            onClick={() => setMoreSheetOpen((prev) => !prev)}
            aria-expanded={moreSheetOpen}
            aria-label="আরও অপশন মেনু খুলুন"
            className={cn(
              "group relative flex min-h-[48px] flex-col items-center justify-center gap-1 py-1 text-center transition-all duration-150 active:scale-[0.94] active:opacity-80",
              isMoreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isMoreActive && (
              <span className="absolute top-0.5 h-0.5 w-6 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-150" />
            )}
            <MoreHorizontal className="size-[22px]" strokeWidth={1.8} />
            <span className="text-[11px] font-medium leading-none tracking-tight">
              আরও
            </span>
          </button>
        </div>
      </nav>

      {/* "আরও" (More) Bottom Sheet Drawer & Scrim */}
      {moreSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          {/* Backdrop Scrim */}
          <div
            onClick={() => setMoreSheetOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            aria-hidden="true"
          />

          {/* Bottom Sheet Modal */}
          <div
            className={cn(
              "relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-[20px] border-t border-border bg-card shadow-2xl",
              "pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-2 px-4",
              "animate-in slide-in-from-bottom duration-250 ease-out",
            )}
          >
            {/* Drag Handle Indicator */}
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 pt-1">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  আরও ফিচার ও সেটিংস
                </h3>
                <p className="text-xs text-muted-foreground">
                  CRM-এর অন্যান্য প্রয়োজনীয় সেকশন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoreSheetOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="মেনু বন্ধ করুন"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* List of Remaining Sections */}
            <div className="mt-3 flex flex-col divide-y divide-border/40">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname, currentTabParam);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreSheetOpen(false)}
                    className={cn(
                      "flex min-h-[52px] items-center justify-between gap-3 py-3 px-2 rounded-lg transition-colors active:scale-[0.98]",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted/70",
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                          active
                            ? "border-primary/40 bg-primary/20 text-primary"
                            : "border-border bg-muted/60 text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4.5" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {item.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground",
                        active && "text-primary",
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
