"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PackSheet } from "@/components/PackSheet";
import { useToast } from "@/components/Toast";
import { api, ApiFailure } from "@/lib/client/api";
import type { PublicProfile } from "@/lib/api";
import {
  CHAT_HEARTBEAT_SECONDS,
  CHAT_IDLE_SECONDS,
  CHAT_PACKS,
  FREE_CHAT_SECONDS,
} from "@/lib/constants";
import { SafetyNotice } from "./SafetyNotice";
import { ChatMenu } from "./ChatMenu";

type Meter = {
  totalSeconds: number;
  consumedSeconds: number;
  remainingSeconds: number;
  freeSecondsLeft: number;
  purchasedSeconds: number;
  locked: boolean;
  onFreeTime: boolean;
  heartbeatSeconds: number;
};

type ChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

const POLL_MS = 2600;

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ChatScreen({
  matchId,
  partner,
  initialMeter,
  chatBanned,
  initiatedByMe,
}: {
  matchId: string;
  partner: PublicProfile;
  initialMeter: Meter;
  chatBanned: boolean;
  /** True when this user sent the dandiya that opened the conversation. */
  initiatedByMe: boolean;
}) {
  const toast = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meter, setMeter] = useState<Meter>(initialMeter);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [packSheet, setPackSheet] = useState<"auto" | "open" | "dismissed">("auto");
  const [loaded, setLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);
  // Not Date.now() here: reading the clock during render is impure, and the
  // mount effect below sets it before any heartbeat can fire.
  const lastInteractionRef = useRef<number>(0);

  /** Presence: the tab is visible AND they have done something recently. */
  const isActive = useCallback(() => {
    if (typeof document === "undefined") return false;
    if (document.visibilityState !== "visible") return false;
    return Date.now() - lastInteractionRef.current < CHAT_IDLE_SECONDS * 1000;
  }, []);

  const noteInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    noteInteraction();
  }, [noteInteraction]);

  /**
   * The sheet opens by itself the moment time runs out, but stays closed once
   * dismissed. Derived rather than set from an effect so it can never fight
   * with the user's own tap.
   */
  const outOfTime = loaded && meter.remainingSeconds <= 0;
  const showPacks =
    packSheet === "open" || (outOfTime && packSheet !== "dismissed");
  const setShowPacks = (open: boolean) =>
    setPackSheet(open ? "open" : "dismissed");

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
        const res = await api.get<{ messages: ChatMessage[]; meter: Meter }>(
          `/api/chat/${matchId}/messages${suffix}`,
        );
        if (cancelled) return;
        applyMessages(res.messages);
        // Only trust the server's meter when we are not mid-countdown, so the
        // local timer does not jump backwards between syncs.
        setMeter((prev) =>
          res.meter.remainingSeconds < prev.remainingSeconds ? res.meter : prev,
        );
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

  // Heartbeat: the only thing that spends time.
  useEffect(() => {
    const beat = async () => {
      try {
        const res = await api.post<{ meter: Meter }>(
          `/api/chat/${matchId}/heartbeat`,
          { active: isActive() },
        );
        setMeter(res.meter);
      } catch {
        /* ignore */
      }
    };

    const timer = setInterval(beat, CHAT_HEARTBEAT_SECONDS * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") noteInteraction();
      beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matchId, isActive, noteInteraction]);

  // Smooth local countdown between heartbeats.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isActive()) return;
      setMeter((prev) =>
        prev.remainingSeconds <= 0
          ? prev
          : { ...prev, remainingSeconds: prev.remainingSeconds - 1 },
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    noteInteraction();
    setSending(true);
    setBlockedNotice(null);

    try {
      const res = await api.post<{ message: ChatMessage; meter: Meter }>(
        `/api/chat/${matchId}/messages`,
        { body },
      );
      setDraft("");
      applyMessages([res.message]);
      setMeter(res.meter);
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 422) {
        // A moderated message stays in the box so they can rewrite it.
        setBlockedNotice(error.message);
        if (error.data.chatBanned) {
          toast.show("Chat paused on your account.", "error");
        }
      } else if (error instanceof ApiFailure && error.status === 402) {
        setShowPacks(true);
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

  const lowTime = meter.remainingSeconds <= 60;

  return (
    <div
      className="flex h-dvh flex-col"
      onPointerDown={noteInteraction}
      onKeyDown={noteInteraction}
    >
      <header className="sticky top-0 z-20 border-b border-gold/15 bg-night/80 pt-safe backdrop-blur-xl">
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

          <button
            onClick={() => setShowPacks(true)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13.5px] font-bold tabular-nums transition-colors ${
              lowTime
                ? "border-rani/50 bg-rani/15 text-rani"
                : "border-parrot/40 bg-parrot/10 text-parrot"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            {clock(meter.remainingSeconds)}
          </button>

          <ChatMenu partner={partner} matchId={matchId} />
        </div>

        {/* Time bar */}
        <div className="h-[3px] w-full bg-cream/10">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${
              lowTime
                ? "bg-gradient-to-r from-rani to-magenta"
                : "bg-gradient-to-r from-parrot to-royal"
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (meter.remainingSeconds / Math.max(1, meter.totalSeconds)) * 100))}%`,
            }}
          />
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
              You each get {FREE_CHAT_SECONDS / 60} free minutes, and the clock
              only runs while you&rsquo;re actually chatting.
            </p>
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

      <div className="border-t border-gold/15 bg-night/85 pb-safe backdrop-blur-xl">
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
          ) : meter.locked ? (
            <button
              onClick={() => setShowPacks(true)}
              className="btn-primary active:btn-primary-active"
            >
              Time&rsquo;s up {"—"} add more minutes
            </button>
          ) : (
            <form onSubmit={send} className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  noteInteraction();
                }}
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

      <PackSheet
        open={showPacks}
        title={meter.locked ? "Time’s up" : "Add more time"}
        subtitle={
          meter.locked
            ? "Your free minutes are done. Top up to keep this conversation going."
            : "Add minutes now so the chat doesn’t stop mid-sentence."
        }
        packs={CHAT_PACKS}
        matchId={matchId}
        onClose={() => setShowPacks(false)}
        onPurchased={async () => {
          const res = await api.get<{ meter: Meter }>(`/api/chat/${matchId}`);
          setMeter(res.meter);
          setPackSheet("auto");
        }}
      />
    </div>
  );
}
