"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { api, ApiFailure } from "@/lib/client/api";
import type { PublicProfile } from "@/lib/api";
import { SafetyNotice } from "./SafetyNotice";
import { ChatMenu } from "./ChatMenu";

type ChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

const POLL_MS = 2600;

export function ChatScreen({
  matchId,
  partner,
  chatBanned,
  initiatedByMe,
}: {
  matchId: string;
  partner: PublicProfile;
  chatBanned: boolean;
  /** True when this user sent the dandiya that opened the conversation. */
  initiatedByMe: boolean;
}) {
  const toast = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);

  const applyMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      return merged;
    });
    lastAtRef.current = incoming[incoming.length - 1].createdAt;
  }, []);

  // Initial load, then incremental polling.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const suffix = lastAtRef.current
          ? `?after=${encodeURIComponent(lastAtRef.current)}`
          : "";
        const res = await api.get<{ messages: ChatMessage[] }>(
          `/api/chat/${matchId}/messages${suffix}`,
        );
        if (cancelled) return;
        applyMessages(res.messages);
        setLoaded(true);
      } catch {
        /* transient; the next tick retries */
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [matchId, applyMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setBlockedNotice(null);

    try {
      const res = await api.post<{ message: ChatMessage }>(
        `/api/chat/${matchId}/messages`,
        { body },
      );
      setDraft("");
      applyMessages([res.message]);
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 422) {
        // A moderated message stays in the box so they can rewrite it.
        setBlockedNotice(error.message);
        if (error.data.chatBanned) {
          toast.show("Chat paused on your account.", "error");
        }
      } else {
        toast.show(
          error instanceof Error ? error.message : "Could not send.",
          "error",
        );
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-gold/15 bg-night/95 pt-safe">
        <div className="app-shell flex items-center gap-3 py-2.5">
          <Link href="/matches" aria-label="Back" className="-ml-1 p-1.5">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-cream/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>

          <Avatar src={partner.avatarUrl} name={partner.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[16.5px] font-bold leading-tight">
              {partner.name ?? "A dancer"}
            </p>
            <p className="truncate text-[12.5px] text-cream/55">
              {partner.city ?? "India"}
            </p>
          </div>

          {/* Back to the circle for someone new; this chat stays in Chat. */}
          <Link
            href="/spin"
            className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-marigold/45 bg-marigold/10 px-3 text-[13.5px] font-semibold text-marigold transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marigold"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
            </svg>
            Spin again
          </Link>

          <ChatMenu partner={partner} matchId={matchId} />
        </div>
      </header>

      <div className="app-shell flex-1 overflow-y-auto py-4">
        <SafetyNotice />

        {messages.length === 0 && loaded && (
          <div className="panel mx-auto mt-6 max-w-[340px] p-5 text-center">
            <span className="text-[30px]">{"\u{1FA98}"}</span>
            {initiatedByMe ? (
              <>
                <p className="mt-2 font-display text-[16.5px] font-bold">
                  You sent {partner.name ?? "them"} a dandiya
                </p>
                <p className="mt-1 text-[13.5px] leading-snug text-cream/60">
                  They can read it as soon as you write. Open with where
                  you&rsquo;re dancing tonight {"\u2014"} it works better than
                  &ldquo;hi&rdquo;.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {[
                    "Kem cho! Kaha garba kar rahe ho?",
                    "Aaj raat ka plan kya hai?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setDraft(suggestion)}
                      className="chip text-[12px]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 font-display text-[16.5px] font-bold">
                  {partner.name ?? "Someone"} sent you a dandiya
                </p>
                <p className="mt-1 text-[13.5px] leading-snug text-cream/60">
                  Reply if you like them. If not, you can block or report from
                  the menu at the top {"\u2014"} they are never told.
                </p>
              </>
            )}
            <p className="mt-3 text-[12.5px] leading-snug text-cream/45">
              Chatting is free, with no timer.
            </p>
            <Link href="/spin" className="btn-ghost mt-3 min-h-[44px] text-[14.5px]">
              Spin again for someone new
            </Link>
          </div>
        )}

        <div className="space-y-2.5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${
                  message.mine
                    ? "rounded-br-md bg-gradient-to-br from-marigold to-marigold-deep text-night"
                    : "rounded-bl-md border border-white/12 bg-white/8 text-cream"
                }`}
              >
                {message.body}
                <span
                  className={`mt-1 block text-right text-[10.5px] ${
                    message.mine ? "text-night/55" : "text-cream/40"
                  }`}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gold/15 bg-night/95 pb-safe">
        <div className="app-shell py-3">
          {blockedNotice && (
            <div className="animate-rise mb-2.5 flex gap-2.5 rounded-2xl border border-rani/45 bg-rani/12 px-3.5 py-2.5">
              <span className="text-[16px] leading-none">{"⚠️"}</span>
              <p className="text-[13.5px] leading-snug text-cream/85">
                {blockedNotice}
              </p>
            </div>
          )}

          {chatBanned ? (
            <p className="rounded-2xl border border-rani/40 bg-rani/10 px-4 py-3 text-center text-[14px] text-cream/80">
              Chat is paused on your account after repeated rule breaks.
            </p>
          ) : (
            <form onSubmit={send} className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(e);
                  }
                }}
                rows={1}
                maxLength={800}
                placeholder="Kem cho? Kya plan hai aaj raat ka?"
                className="field max-h-28 min-h-[50px] flex-1 resize-none py-3.5 focus:field-focus"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Send"
                className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-marigold to-marigold-deep text-night shadow-[0_8px_20px_-8px_rgba(255,138,0,0.9)] transition-transform active:scale-95 disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12l16-8-6 8 6 8z" />
                </svg>
              </button>
            </form>
          )}
        </div>
      </div>

    </div>
  );
}
