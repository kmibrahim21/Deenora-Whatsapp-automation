"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import {
  getNotificationPermission,
  writeBrowserNotifyPref,
  registerNotificationServiceWorker,
} from "@/lib/notifications/browser-notify";

/**
 * Mount ONCE per signed-in dashboard tab (the dashboard
 * shell, below the auth gate) so notifications for new customer
 * messages fire on every dashboard page, not just the inbox.
 *
 * Also provides a 1-tap permission prompt if the user hasn't yet
 * enabled notifications.
 */
export function BrowserNotificationsListener() {
  useBrowserNotifications();

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("granted");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
    const isDismissed = sessionStorage.getItem("wacrm:notify-banner-dismissed") === "1";
    setDismissed(isDismissed);
  }, []);

  const handleEnable = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      void registerNotificationServiceWorker();
      const res = await Notification.requestPermission();
      setPermission(res);
      writeBrowserNotifyPref(res === "granted");
    } catch (err) {
      console.error("Failed to request notification permission:", err);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("wacrm:notify-banner-dismissed", "1");
    } catch {}
  };

  // Only show when permission hasn't been granted/denied yet ('default') and user hasn't dismissed in this session
  if (permission !== "default" || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-xl sm:bottom-6 sm:right-6">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bell className="size-4 animate-bounce" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Turn on Notifications</p>
          <p className="text-[11px] text-muted-foreground truncate">Get sound & alerts when customers message you.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" className="h-7 px-2.5 text-xs font-medium" onClick={handleEnable}>
          Enable
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
