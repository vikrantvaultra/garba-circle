"use client";

/**
 * The live unread count, shared by the notifier (which polls it) and the
 * bottom nav (which shows it). Null until the first answer arrives, so the
 * nav keeps the count its page was rendered with until then.
 */

const EVENT = "gc-inbox-count";
/** Fired when a message arrives for a chat, so open screens fetch it now. */
export const MESSAGE_EVENT = "gc-new-message";

let unread: number | null = null;

export function setUnread(next: number | null) {
  if (next === unread) return;
  unread = next;
  window.dispatchEvent(new Event(EVENT));
}

export function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
export const getSnapshot = () => unread;
export const getServerSnapshot = (): number | null => null;

/** Tell open screens a message just arrived in this chat. */
export function announce(matchId: string) {
  window.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail: { matchId } }));
}

/** Listen for arrivals, optionally only for one chat. */
export function onMessage(handler: (matchId: string) => void, matchId?: string) {
  const listener = (e: Event) => {
    const id = (e as CustomEvent<{ matchId: string }>).detail?.matchId;
    if (!matchId || id === matchId) handler(id);
  };
  window.addEventListener(MESSAGE_EVENT, listener);
  return () => window.removeEventListener(MESSAGE_EVENT, listener);
}
