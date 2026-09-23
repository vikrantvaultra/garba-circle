"use client";

/**
 * Message notifications on this device.
 *
 *   unsupported    the browser can't, or the server has no VAPID keys
 *   needs-install  an iPhone in Safari: web push only works once the app is
 *                  added to the Home Screen and opened from there
 *   denied         the person blocked notifications for the site
 *   ask            never asked; a tap on "Turn on" shows the prompt
 *   off            allowed, but turned off in the app
 *   on             this device gets a notification for every new message
 *
 * The "off" choice is a per-device convenience kept in localStorage.
 */

export type PushState = "unsupported" | "needs-install" | "denied" | "ask" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const OFF_KEY = "gc_push_off_v1";
const SYNCED_KEY = "gc_push_synced_v1";
const EVENT = "gc-push-state";

let state: PushState = "unsupported";
let registration: ServiceWorkerRegistration | null = null;
let started = false;

function set(next: PushState) {
  if (next === state) return;
  state = next;
  window.dispatchEvent(new Event(EVENT));
}

export function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
export const getSnapshot = () => state;
export const getServerSnapshot = (): PushState => "unsupported";

function isIOS(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supported(): boolean {
  return (
    Boolean(PUBLIC_KEY) &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function turnedOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

function markOff(off: boolean) {
  try {
    if (off) localStorage.setItem(OFF_KEY, "1");
    else localStorage.removeItem(OFF_KEY);
  } catch {
    /* private mode: the choice lasts for this page */
  }
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function send(method: "POST" | "DELETE", body: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/push", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Tell the server this browser belongs to whoever is signed in now. */
async function sync(sub: PushSubscription) {
  let done = "";
  try {
    done = sessionStorage.getItem(SYNCED_KEY) ?? "";
  } catch {
    /* no session storage: sync every load, which is harmless */
  }
  if (done === sub.endpoint) return;
  // A 401 on a signed-out page is expected; it syncs after sign-in instead.
  if (await send("POST", sub.toJSON())) {
    try {
      sessionStorage.setItem(SYNCED_KEY, sub.endpoint);
    } catch {
      /* see above */
    }
  }
}

/**
 * Register the worker and work out the state. When permission was granted
 * earlier (or the subscription was dropped on sign-out), subscribe again
 * silently: no prompt appears once permission is granted.
 */
export async function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  if (isIOS() && !isStandalone()) {
    set("needs-install");
    return;
  }
  if (!supported()) return;

  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    return;
  }

  if (Notification.permission === "denied") {
    set("denied");
    return;
  }
  if (Notification.permission === "default") {
    set("ask");
    return;
  }
  if (turnedOff()) {
    set("off");
    return;
  }
  try {
    const sub =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(PUBLIC_KEY),
      }));
    set("on");
    await sync(sub);
  } catch {
    set("off");
  }
}

/**
 * Called on every navigation. Signing in happens without a page load, so
 * this is where a subscription made while signed out reaches the account.
 */
export async function refresh() {
  if (!started) return start();
  if (state !== "on" || !registration) return;
  try {
    const sub = await registration.pushManager.getSubscription();
    if (sub) await sync(sub);
  } catch {
    /* next navigation tries again */
  }
}

/**
 * Ask for permission and subscribe. Call it straight from a tap: iPhones only
 * show the permission prompt inside a user gesture, so nothing is awaited
 * before the subscribe call when the worker is already registered.
 */
export async function enable(): Promise<PushState> {
  if (!supported()) return state;
  try {
    const reg = registration ?? (await navigator.serviceWorker.ready);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(PUBLIC_KEY),
    });
    markOff(false);
    try {
      sessionStorage.removeItem(SYNCED_KEY);
    } catch {
      /* ignore */
    }
    set("on");
    await sync(sub);
  } catch {
    set(Notification.permission === "denied" ? "denied" : Notification.permission === "granted" ? "off" : "ask");
  }
  return state;
}

/** Stop notifications on this device only. */
export async function disable(): Promise<void> {
  markOff(true);
  set("off");
  await forget();
}

/** Signing out: this device stops getting that account's messages. */
export async function forget(): Promise<void> {
  // The next account to sign in here gets its own subscription.
  started = false;
  if (!supported()) return;
  try {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration());
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await send("DELETE", { endpoint: sub.endpoint });
    await sub.unsubscribe();
    sessionStorage.removeItem(SYNCED_KEY);
  } catch {
    /* nothing more to undo */
  }
}
