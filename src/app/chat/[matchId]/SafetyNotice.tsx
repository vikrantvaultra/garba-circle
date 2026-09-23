"use client";

import { useSyncExternalStore } from "react";

const KEY = "gc_safety_seen";
const EVENT = "gc-safety-dismissed";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Private mode: show the notice rather than swallow it.
    return false;
  }
}

/** Hidden during server render so returning users never see it flash. */
function getServerSnapshot(): boolean {
  return true;
}

/** Shown once per device, above the first messages. */
export function SafetyNotice() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode — the notice simply shows again next time */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="animate-rise mb-4 rounded-2xl border border-parrot/35 bg-parrot/8 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="text-[17px] leading-none">{"\u{1F6E1}️"}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold text-parrot">
            This chat is protected
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-cream/70">
            Phone numbers, links and abusive language are blocked automatically
            in Hindi, Marathi, Gujarati and English. Meet at the ground, not in
            the DMs.
          </p>
          <button
            onClick={dismiss}
            className="mt-2 text-[13px] font-semibold text-parrot"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
