"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { api } from "@/lib/client/api";
import type { Conversation, MatchesPayload } from "@/lib/matches/list";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function preview(conversation: Conversation): string {
  if (!conversation.lastMessage) {
    return conversation.initiatedByMe
      ? "You sent a dandiya — say hello"
      : "Sent you a dandiya";
  }
  const { body, mine } = conversation.lastMessage;
  return `${mine ? "You: " : ""}${body}`;
}

export function MatchesScreen({ initial }: { initial: MatchesPayload }) {
  const [data, setData] = useState(initial);

  // Keep unread counts honest while the tab is open.
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        setData(await api.get<MatchesPayload>("/api/matches"));
      } catch {
        /* keep the last good list */
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, []);

  const { conversations } = data;

  return (
    <main className="app-shell min-h-dvh pt-safe pb-32">
      <header className="py-4">
        <h1 className="gold-text font-display text-[26px] font-extrabold leading-none">
          Your circle
        </h1>
        <p className="mt-1.5 text-[13.5px] text-cream/55">
          {conversations.length === 0
            ? "Every dandiya you send opens a chat right here."
            : `${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"}`}
        </p>
      </header>

      {conversations.length === 0 ? (
        <div className="panel p-7 text-center">
          <span className="text-[34px]">{"\u{1F483}"}</span>
          <p className="mt-2 font-display text-[17px] font-bold">
            No chats yet
          </p>
          <p className="mt-1 text-[14px] leading-snug text-cream/60">
            Spin the circle, and when someone catches your eye send a dandiya.
            The chat opens straight away.
          </p>
          <Link href="/spin" className="btn-primary active:btn-primary-active mt-4">
            Spin the circle
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {conversations.map((conversation) => {
            const unread = conversation.unread > 0;
            const isNew = unread && !conversation.lastMessage?.mine;
            return (
              <Link
                key={conversation.matchId}
                href={`/chat/${conversation.matchId}`}
                className={`panel flex items-center gap-3 p-3.5 transition-transform active:scale-[0.99] ${
                  unread ? "border-marigold/45" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={conversation.partner.avatarUrl}
                    name={conversation.partner.name}
                    size={54}
                  />
                  {unread && (
                    <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-night bg-rani" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-[16.5px] font-bold leading-tight">
                      {conversation.partner.name ?? "A dancer"}
                    </p>
                    {isNew && (
                      <span className="shrink-0 rounded-full bg-rani px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider text-white">
                        NEW
                      </span>
                    )}
                  </div>
                  <p
                    className={`truncate text-[13px] ${unread ? "font-semibold text-cream/85" : "text-cream/55"}`}
                  >
                    {preview(conversation)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[11.5px] text-cream/40">
                    {timeAgo(
                      conversation.lastMessage?.createdAt ?? conversation.createdAt,
                    )}
                  </p>
                  {conversation.unread > 0 && (
                    <span className="mt-1 inline-grid h-[19px] min-w-[19px] place-items-center rounded-full bg-marigold px-1.5 text-[11px] font-bold text-night">
                      {conversation.unread > 9 ? "9+" : conversation.unread}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <BottomNav badge={data.unreadTotal} />
    </main>
  );
}
