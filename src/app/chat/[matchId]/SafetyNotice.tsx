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
    <div className="animate-rise mb-4 rounded-2xl border border-pista/30 bg-white p-3.5 shadow-[0_8px_20px_-14px_rgba(78,154,58,0.8)]">
      <div className="flex items-start gap-2.5">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-pista" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-black text-pista">
            This chat is protected
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-choco-2">
            Phone numbers, links and abusive language are blocked automatically
            in Hindi, Marathi, Gujarati and English. Meet at the ground, not in
            the DMs.
          </p>
          <button
            onClick={dismiss}
            className="mt-2 text-[13px] font-extrabold text-pista"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
