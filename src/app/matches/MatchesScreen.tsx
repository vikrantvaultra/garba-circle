"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { NotifyPrompt } from "@/components/NotifyPrompt";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { Scoop } from "@/components/brand/Scoop";
import { NIGHT_FLAVOURS } from "@/lib/havmor";
import { api } from "@/lib/client/api";
import { onMessage } from "@/lib/client/inbox";
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
  // A new message anywhere reorders the list at once.
  useEffect(() => {
    const refresh = async () => {
      try {
        setData(await api.get<MatchesPayload>("/api/matches"));
      } catch {
        /* keep the last good list */
      }
    };
    const timer = setInterval(refresh, 20_000);
    const stop = onMessage(() => void refresh());
    return () => {
      clearInterval(timer);
      stop();
    };
  }, []);

  const { conversations } = data;

  return (
    <main className="app-shell min-h-dvh pb-32">
      <BrandHeader
        title="Your chats"
        sub={
          conversations.length === 0
            ? "Every dandiya you send opens a chat right here."
            : `${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"}`
        }
      />

      <NotifyPrompt />

      {conversations.length === 0 ? (
        <div className="panel p-7 text-center">
          <Scoop flavour={NIGHT_FLAVOURS[0]} scoops={2} size={72} className="mx-auto" />
          <p className="headline mt-2 text-[18px]">
            No chats yet
          </p>
          <p className="mt-1 text-[14px] leading-snug text-choco-2">
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
                  unread ? "border-havmor/40" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={conversation.partner.avatarUrl}
                    name={conversation.partner.name}
                    size={54}
                  />
                  {unread && (
                    <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-havmor" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="headline truncate text-[16.5px] leading-tight">
                      {conversation.partner.name ?? "A dancer"}
                    </p>
                    {isNew && (
                      <span className="shrink-0 rounded-full bg-havmor px-1.5 py-0.5 text-[9.5px] font-black tracking-wider text-white">
                        NEW
                      </span>
                    )}
                  </div>
                  <p
                    className={`truncate text-[13px] ${unread ? "font-bold text-choco" : "text-choco-2"}`}
                  >
                    {preview(conversation)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[11.5px] font-semibold text-cocoa">
                    {timeAgo(
                      conversation.lastMessage?.createdAt ?? conversation.createdAt,
                    )}
                  </p>
                  {conversation.unread > 0 && (
                    <span className="mt-1 inline-grid h-[19px] min-w-[19px] place-items-center rounded-full bg-havmor px-1.5 text-[11px] font-black text-white">
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
