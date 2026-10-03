"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bell,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";

interface BottomNavProps {
  onOpenSidebar: () => void;
  className?: string;
}

export function BottomNav({ onOpenSidebar, className }: BottomNavProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();

  // If on mobile inbox with an open conversation (?c=...), hide the bottom nav
  // so the message thread and mobile keyboard have full height.
  const isMobileThreadOpen = pathname === "/inbox" && !!searchParams?.get("c");
  if (isMobileThreadOpen) {
    return null;
  }

  const navItems = [
    {
      href: "/dashboard",
      label: t("dashboard"),
      icon: LayoutDashboard,
      showBadge: false,
      badgeContent: null,
      isActive: pathname === "/dashboard",
      permission: "dashboard",
    },
    {
      href: "/inbox",
      label: t("inbox"),
      icon: MessageSquare,
      showBadge: totalUnread > 0,
      badgeContent: totalUnread > 9 ? "9+" : totalUnread,
      isActive: pathname.startsWith("/inbox"),
      permission: "inbox",
    },
    {
      href: "/contacts",
      label: t("contacts"),
      icon: Users,
      showBadge: false,
      badgeContent: null,
      isActive: pathname.startsWith("/contacts"),
      permission: "contacts",
    },
    {
      href: "/notifications",
      label: t("notifications"),
      icon: Bell,
      showBadge: unreadNotifications > 0,
      badgeContent: unreadNotifications > 9 ? "9+" : unreadNotifications,
      isActive: pathname.startsWith("/notifications"),
      permission: "notifications",
    },
  ];

  // Filter items based on user permissions
  const visibleItems = navItems.filter((item) => hasPermission(item.permission));

  return (
    <nav
      aria-label={t("primaryNav")}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom,0px)] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden",
        className,
      )}
    >
      <div className="flex w-full items-center justify-around">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex flex-1 flex-col items-center justify-center py-2 transition-colors focus-visible:outline-none",
                active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium",
              )}
            >
              {/* Active top indicator pill */}
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
              )}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={cn(
                    "size-5 transition-transform duration-150",
                    active && "scale-110 text-primary",
                  )}
                />
                {item.showBadge && (
                  <span
                    className={cn(
                      "absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-card",
                    )}
                  >
                    {item.badgeContent}
                  </span>
                )}
              </div>
              <span className="mt-1 max-w-[64px] truncate text-[11px] leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More / Menu Drawer trigger */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label={t("more")}
          className="group relative flex flex-1 flex-col items-center justify-center py-2 text-muted-foreground font-medium transition-colors hover:text-foreground focus-visible:outline-none"
        >
          <div className="relative flex items-center justify-center">
            <Menu className="size-5 transition-transform duration-150 group-hover:scale-105" />
          </div>
          <span className="mt-1 max-w-[64px] truncate text-[11px] leading-tight">
            {t("more")}
          </span>
        </button>
      </div>
    </nav>
  );
}
