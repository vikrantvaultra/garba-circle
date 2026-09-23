"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import * as push from "@/lib/client/push";
import { announce, setUnread } from "@/lib/client/inbox";
import { buzz } from "@/lib/client/haptics";
import type { InboxSummary } from "@/lib/matches/list";
import styles from "./notifier.module.css";

type Latest = NonNullable<InboxSummary["latest"]>;

/** Screens where nobody is signed in, so there is nothing to check. */
const SIGNED_OUT = new Set(["/", "/login"]);
/** How often to look for new messages while the app is on screen. */
const POLL_MS = 10_000;
/** With push on, the service worker says when to look; this is a backstop. */
const POLL_WITH_PUSH_MS = 60_000;
const BANNER_MS = 5_000;

// Kept across client-side navigations: the newest message already dealt
// with, and messages the phone already showed as a system notification.
let seenUntil: string | null = null;
const shownByPhone = new Set<string>();
/** The public map works signed out; after a 401 don't ask again on that screen. */
let signedOutOn: string | null = null;

/**
 * New messages while the app is open, on any screen: a banner at the top
 * ("Priya: kem cho?") that opens the chat, a live unread badge on the nav,
 * and an instant refresh of an open chat. With push turned on, the service
 * worker also notifies when the app is closed and wakes this up at once.
 */
export function MessageNotifier() {
  const pathname = usePathname();
  const router = useRouter();
  const pushState = useSyncExternalStore(push.subscribe, push.getSnapshot, push.getServerSnapshot);
  const [banner, setBanner] = useState<Latest | null>(null);
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = !SIGNED_OUT.has(pathname);

  const show = (latest: Latest) => {
    setBanner(latest);
    setOpen(true);
    buzz(20, false);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), BANNER_MS);
  };

  const check = useEffectEvent(async () => {
    if (!active || signedOutOn === pathname || document.visibilityState !== "visible") return;
    let data: InboxSummary;
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" });
      if (res.status === 401) {
        signedOutOn = pathname;
        setUnread(null);
        return;
      }
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }
    setUnread(data.unreadTotal);

    const latest = data.latest;
    // First look: what's already waiting is the badge's job, not a banner's.
    if (seenUntil === null) {
      seenUntil = latest && latest.createdAt > data.now ? latest.createdAt : data.now;
      return;
    }
    if (!latest || latest.createdAt <= seenUntil) return;
    seenUntil = latest.createdAt;
    announce(latest.matchId);

    const reading = window.location.pathname === `/chat/${latest.matchId}`;
    if (reading || shownByPhone.has(latest.messageId)) return;
    show(latest);
  });

  // Register the worker, and after sign-in hand it to the new account.
  useEffect(() => {
    void push.refresh();
  }, [pathname]);

  // Poll while on screen, and look again the moment the app comes back.
  useEffect(() => {
    if (!active) return;
    const first = setTimeout(() => void check(), 0);
    const timer = setInterval(() => void check(), pushState === "on" ? POLL_WITH_PUSH_MS : POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, pathname, pushState]);

  const onWorkerMessage = useEffectEvent((event: MessageEvent) => {
    const data = event.data as
      | { type: "gc-open"; url: string }
      | { type: "gc-message"; matchId: string; messageId: string; shown: boolean }
      | undefined;
    if (data?.type === "gc-open") {
      setOpen(false);
      router.push(data.url);
    } else if (data?.type === "gc-message") {
      if (data.shown) shownByPhone.add(data.messageId);
      announce(data.matchId);
      void check();
    }
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const listener = (event: MessageEvent) => onWorkerMessage(event);
    navigator.serviceWorker.addEventListener("message", listener);
    return () => navigator.serviceWorker.removeEventListener("message", listener);
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const initial = (banner?.name ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={styles.wrap} data-open={open} inert={!open}>
      <div className={styles.banner} role="status" aria-live="polite">
        <button
          type="button"
          className={styles.main}
          onClick={() => {
            setOpen(false);
            if (banner) router.push(`/chat/${banner.matchId}`);
          }}
        >
          <span className={styles.avatar} aria-hidden>
            {initial}
          </span>
          <span className={styles.text}>
            <b>{banner?.name ?? "New message"}</b>
            <span>{banner?.body}</span>
          </span>
        </button>
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss"
          onClick={() => setOpen(false)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
