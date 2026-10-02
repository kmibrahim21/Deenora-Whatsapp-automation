"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";
import {
  DEFAULT_NOTIFICATION_LABELS,
  buildNotificationContent,
  conversationHref,
  displayNotification,
  getNotificationPermission,
  initAudioOnUserGesture,
  pickContactDisplayName,
  playNotificationSound,
  readBrowserNotifyPref,
  readBrowserNotifySoundPref,
  registerNotificationServiceWorker,
  shouldNotifyForMessage,
  subscribeBrowserNotifyPref,
  subscribeBrowserNotifySoundPref,
  viewedConversationFromLocation,
  type NotificationLabels,
} from "@/lib/notifications/browser-notify";

const serverSnapshot = () => false;
const serverSoundSnapshot = () => true;

/**
 * The device-scoped "browser notifications" opt-in, kept in sync with
 * localStorage across this tab (settings toggle) and other tabs.
 */
export function useBrowserNotifyPref(): boolean {
  return useSyncExternalStore(
    subscribeBrowserNotifyPref,
    readBrowserNotifyPref,
    serverSnapshot,
  );
}

/**
 * The device-scoped "notification sound" opt-in (default: ON), kept in sync with
 * localStorage across this tab and other tabs.
 */
export function useBrowserNotifySoundPref(): boolean {
  return useSyncExternalStore(
    subscribeBrowserNotifySoundPref,
    readBrowserNotifySoundPref,
    serverSoundSnapshot,
  );
}

/**
 * Desktop notifications for new inbound customer messages. Mount ONCE
 * per signed-in dashboard tab (the dashboard shell does this via
 * <BrowserNotificationsListener />) so alerts fire on any page.
 *
 * Listens for realtime INSERTs on `messages` — RLS scopes the stream to
 * the caller's account, same as useTotalUnread / useRealtime. Only
 * live events are considered: there is no initial fetch, so an existing
 * backlog never produces a burst of alerts on page load.
 *
 * Own channel name so it coexists with the inbox page's subscription
 * and the sidebar's unread counters.
 *
 * Fires only while a dashboard tab is open — there is no service worker
 * or Web Push here, so a closed browser stays quiet.
 */
export function useBrowserNotifications(): void {
  const enabled = useBrowserNotifyPref();
  const router = useRouter();
  const t = useTranslations("Settings.browserNotifications.labels");

  // Register service worker for mobile notifications (Android / PWA)
  useEffect(() => {
    void registerNotificationServiceWorker();
  }, []);

  // Unlock AudioContext on first user gesture (click/keypress) so background chime works
  useEffect(() => {
    const cleanup = initAudioOnUserGesture();
    return cleanup;
  }, []);

  // Translated labels, read inside the async Realtime callback. Kept in
  // a ref (assigned in an effect, not during render) so a locale change
  // doesn't tear down and re-open the channel.
  const labelsRef = useRef<NotificationLabels>(DEFAULT_NOTIFICATION_LABELS);
  useEffect(() => {
    labelsRef.current = {
      fallbackTitle: t("fallbackTitle"),
      image: t("image"),
      audio: t("audio"),
      video: t("video"),
      document: t("document"),
      location: t("location"),
      template: t("template"),
    };
  });

  const soundEnabled = useBrowserNotifySoundPref();

  // Message ids already handled, for replay dedupe. Survives re-renders,
  // pruned by shouldNotifyForMessage.
  const seenRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Keep listener active if browser notify or notification sound is opted-in
    if (!enabled && !soundEnabled) return;

    const supabase = createClient();
    let cancelled = false;

    const notify = async (msg: Message) => {
      // 1. If sound is enabled on this device, play the pleasant chime
      if (soundEnabled) {
        playNotificationSound();
      }

      // 2. Fetch contact displayName
      const { data } = await supabase
        .from("conversations")
        .select("contact:contacts(name, wa_username, phone)")
        .eq("id", msg.conversation_id)
        .maybeSingle();
      if (cancelled) return;

      const contact = (data as {
        contact?: { name?: string | null; wa_username?: string | null; phone?: string | null } | null;
      } | null)?.contact;
      const { title, body } = buildNotificationContent(
        msg,
        pickContactDisplayName(contact),
        labelsRef.current,
      );

      const targetHref = conversationHref(msg.conversation_id);

      // 3. Always show in-app toast notification so user in active tab immediately sees message
      toast(title, {
        description: body,
        action: {
          label: "View",
          onClick: () => {
            window.focus();
            router.push(targetHref);
          },
        },
      });

      // 4. If system notifications are enabled and permission is granted, dispatch desktop/mobile notification
      if (enabled && getNotificationPermission() === "granted") {
        await displayNotification(
          title,
          {
            body,
            tag: msg.conversation_id,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            url: targetHref,
          },
          () => {
            window.focus();
            router.push(targetHref);
          }
        );
      }
    };

    const channel = supabase
      .channel("browser-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          const shouldNotify = shouldNotifyForMessage(msg, {
            documentVisible: document.visibilityState === "visible",
            viewingConversationId: viewedConversationFromLocation(
              window.location.pathname,
              window.location.search,
            ),
            seen: seenRef.current,
          });
          if (!shouldNotify) return;
          void notify(msg);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled, soundEnabled, router]);
}
