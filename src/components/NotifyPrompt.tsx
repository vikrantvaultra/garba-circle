"use client";

import { useState, useSyncExternalStore } from "react";
import * as push from "@/lib/client/push";
import { useToast } from "./Toast";

const LATER_KEY = "gc_notify_later_v1";
const LATER_EVENT = "gc-notify-later";
/** "Not now" hides the offer for a few nights, not forever. */
const LATER_MS = 3 * 24 * 60 * 60 * 1000;

function subscribeLater(onChange: () => void) {
  window.addEventListener(LATER_EVENT, onChange);
  return () => window.removeEventListener(LATER_EVENT, onChange);
}
function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(LATER_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}
function snooze() {
  try {
    localStorage.setItem(LATER_KEY, String(Date.now() + LATER_MS));
  } catch {
    /* private mode: hidden for this page only */
  }
  window.dispatchEvent(new Event(LATER_EVENT));
}

const Bell = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);

/**
 * The offer to turn on message notifications. A card on the chat list, or a
 * slim bar in a conversation (`name` = who they're waiting on). Shows only
 * while there's something to do: never asked, or an iPhone that has to add
 * the app to its Home Screen first.
 */
export function NotifyPrompt({ variant = "card", name }: { variant?: "card" | "bar"; name?: string | null }) {
  const state = useSyncExternalStore(push.subscribe, push.getSnapshot, push.getServerSnapshot);
  const later = useSyncExternalStore(subscribeLater, snoozed, () => true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (later || (state !== "ask" && state !== "needs-install")) return null;

  const turnOn = async () => {
    setBusy(true);
    const next = await push.enable();
    setBusy(false);
    if (next === "on") {
      toast.show("Notifications on. You’ll know when someone writes.", "success");
    } else if (next === "denied") {
      toast.show("Notifications are blocked for this site in your browser settings.", "warn");
    } else {
      toast.show("Couldn’t turn on notifications in this browser.", "error");
    }
  };

  const who = name?.trim().split(/\s+/)[0];

  if (state === "needs-install") {
    return (
      <div className={variant === "bar" ? "mb-2.5 rounded-2xl border border-marigold/30 bg-marigold/8 px-3.5 py-3" : "panel mb-3 p-4"}>
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-marigold/15 text-marigold">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold">Get message alerts on your iPhone</p>
            <p className="mt-0.5 text-[13px] leading-snug text-cream/65">
              Tap Share <span aria-hidden>{"⎋"}</span>, then <b className="text-cream/85">Add to Home Screen</b>. Open
              Garba Circle from there and turn notifications on.
            </p>
            <button type="button" onClick={snooze} className="mt-2 min-h-[36px] text-[13px] font-semibold text-marigold">
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className="animate-rise mb-2.5 flex items-center gap-2.5 rounded-2xl border border-marigold/30 bg-marigold/8 py-2 pl-3 pr-1.5">
        <Bell className="h-5 w-5 shrink-0 text-marigold" />
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-cream/85">
          Get notified when {who ?? "they"} {who ? "replies" : "reply"}
        </p>
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="min-h-[36px] shrink-0 rounded-xl bg-marigold px-3 text-[13.5px] font-bold text-plum disabled:opacity-60"
        >
          Turn on
        </button>
        <button type="button" onClick={snooze} aria-label="Not now" className="grid h-9 w-9 shrink-0 place-items-center text-cream/50">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="panel animate-rise mb-3 p-4">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marigold/15 text-marigold">
          <Bell className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] leading-tight">Know when they write</p>
          <p className="mt-1 text-[13.5px] leading-snug text-cream/65">
            Get a notification for every new message, even when the app is closed.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={turnOn}
              disabled={busy}
              className="min-h-[40px] rounded-xl bg-marigold px-4 text-[14px] font-bold text-plum disabled:opacity-60"
            >
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
            <button type="button" onClick={snooze} className="min-h-[40px] px-3 text-[14px] font-semibold text-muted">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The switch on the profile screen. Applies to this device only. */
export function NotifySetting() {
  const state = useSyncExternalStore(push.subscribe, push.getSnapshot, push.getServerSnapshot);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const on = state === "on";
  const canToggle = state === "on" || state === "off" || state === "ask";

  const note =
    state === "on"
      ? "On for this device. A notification for every new message."
      : state === "denied"
        ? "Blocked for this site. Allow notifications in your browser settings."
        : state === "needs-install"
          ? "On iPhone, add Garba Circle to your Home Screen (Share, then Add to Home Screen) and open it from there."
          : state === "unsupported"
            ? "This browser can’t show notifications."
            : "Off. Turn on to hear about new messages when the app is closed.";

  const toggle = async () => {
    setBusy(true);
    if (on) {
      await push.disable();
    } else {
      const next = await push.enable();
      if (next === "denied") toast.show("Notifications are blocked for this site in your browser settings.", "warn");
      else if (next !== "on") toast.show("Couldn’t turn on notifications in this browser.", "error");
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold">Message notifications</h3>
        <p className="mt-1 text-[13.5px] leading-snug text-cream/60">{note}</p>
      </div>
      {canToggle && (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Message notifications"
          disabled={busy}
          onClick={toggle}
          className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${on ? "bg-marigold" : "bg-white/15"}`}
        >
          <span
            aria-hidden
            className={`absolute left-[3px] top-[3px] h-6 w-6 rounded-full bg-cream shadow transition-transform duration-200 ${on ? "translate-x-[22px]" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
