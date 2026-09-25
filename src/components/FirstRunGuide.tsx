"use client";

import { useSyncExternalStore } from "react";
import { Wordmark } from "@/components/brand/Wordmark";

const KEY = "gc_guide_seen_v1";
const EVENT = "gc-guide-dismissed";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // if storage is unavailable, don't nag on every load
  }
}

/** Hidden during server render so it never flashes for returning dancers. */
function getServerSnapshot(): boolean {
  return true;
}

const STEPS = [
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      </>
    ),
    title: "Choose, then spin",
    body: "Pick a city and who you’d like to meet, then tap the cone in the middle. It stops on a real dancer. Your first five spins are free.",
  },
  {
    icon: <path d="M6 5l12 14M18 5L6 19" />,
    title: "Send a dandiya",
    body: "Like who you see? Send a dandiya — no waiting for them to accept. Every jodi comes with a Havmor scoop to share.",
  },
  {
    icon: (
      <>
        <path d="M4.5 6.5h15v10h-9l-4 3.5v-3.5h-2z" />
        <path d="M8.5 11h7M8.5 13.5h4" />
      </>
    ),
    title: "Chat opens instantly",
    body: "Chatting is free, with no timer. Numbers, links and abuse are blocked.",
  },
];

/**
 * Shown once per device, before the first spin. The flow changed from
 * "invite, wait for an accept" to "send a dandiya and you are talking", and
 * nobody can be expected to guess that.
 */
export function FirstRunGuide() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-choco/60"
        onClick={dismiss}
      />
      <div className="animate-sheet relative w-full max-w-[460px] rounded-t-[30px] border-t-[5px] border-havmor bg-vanilla px-5 pt-3 pb-safe">
        <div className="mx-auto mb-5 h-1.5 w-11 rounded-full bg-choco/15" />

        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-havmor">How it works</p>
          <Wordmark tone="red" width={70} />
        </div>
        <h2 className="headline mt-1 text-[28px] leading-tight">
          Three taali, that&rsquo;s it
        </h2>

        <div className="mt-5 space-y-3.5">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-3.5">
              <div className="relative flex flex-col items-center">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-havmor text-white shadow-[0_6px_14px_-6px_rgba(211,0,43,0.7)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[21px] w-[21px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {step.icon}
                  </svg>
                </span>
                {i < STEPS.length - 1 && (
                  <span className="mt-1 h-4 w-0.5 rounded-full bg-havmor/25" />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <h3 className="headline text-[16px] leading-tight">
                  <span className="mr-1.5 text-havmor">{i + 1}.</span>
                  {step.title}
                </h3>
                <p className="mt-0.5 text-[13.5px] leading-snug text-choco-2">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={dismiss} className="btn-primary active:btn-primary-active mt-6 mb-2">
          Chalo, let&rsquo;s spin
        </button>
      </div>
    </div>
  );
}
