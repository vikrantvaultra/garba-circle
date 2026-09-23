import { z } from "zod";
import { after } from "next/server";
import { and, asc, desc, eq, gt, or } from "drizzle-orm";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { db } from "@/lib/db";
import { blocks, chatSessions, matches, messages } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { loadMatchFor } from "@/lib/chat/match";
import {
  ensureChatSession,
  rememberCarryDigits,
  usableCarry,
} from "@/lib/chat/session";
import { moderateText } from "@/lib/moderation";
import { isChatBanned, recordBlock } from "@/lib/moderation/record";
import { sendPush } from "@/lib/push";

/** Long enough to read on a lock screen, short enough to stay one glance. */
function preview(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  return guard(async () => {
    const user = await requireUser();
    const { matchId } = await ctx.params;

    const context = await loadMatchFor(user.id, matchId);
    if (!context) return fail("Chat not found.", 404);

    const after = new URL(req.url).searchParams.get("after");
    const afterDate = after ? new Date(after) : null;
    const validAfter =
      afterDate && !Number.isNaN(afterDate.getTime()) ? afterDate : null;

    // Incremental polls want everything after a timestamp, oldest first.
    // The first load wants the *latest* page, so it is fetched newest-first
    // and flipped — otherwise a long conversation would open on its first
    // 200 messages instead of its most recent ones.
    const rows = validAfter
      ? await db
          .select()
          .from(messages)
          .where(
            and(eq(messages.matchId, matchId), gt(messages.createdAt, validAfter)),
          )
          .orderBy(asc(messages.createdAt))
          .limit(200)
      : (
          await db
            .select()
            .from(messages)
            .where(eq(messages.matchId, matchId))
            .orderBy(desc(messages.createdAt))
            .limit(200)
        ).reverse();

    // Reading the conversation is what marks it read; there is no separate
    // "seen" call to forget to make.
    await db
      .update(chatSessions)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatSessions.matchId, matchId),
          eq(chatSessions.userId, user.id),
        ),
      );

    return json({
      messages: rows.map((m) => ({
        id: m.id,
        body: m.body,
        mine: m.senderId === user.id,
        createdAt: m.createdAt,
      })),
    });
  });
}

const Body = z.object({ body: z.string().min(1).max(1000) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  return guard(async () => {
    const user = await requireUser();
    const { matchId } = await ctx.params;

    const context = await loadMatchFor(user.id, matchId);
    if (!context) return fail("Chat not found.", 404);

    if (isChatBanned(user)) {
      return fail(
        "Chat is paused on your account after repeated rule breaks.",
        403,
        { chatBanned: true, until: user.chatBannedUntil },
      );
    }

    if (!rateLimit(`msg:${user.id}`, 25, 10 * 1000)) {
      return fail("You’re sending messages too quickly.", 429);
    }

    const blocked = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, context.partner.id)),
          and(eq(blocks.blockerId, context.partner.id), eq(blocks.blockedId, user.id)),
        ),
      )
      .limit(1);
    if (blocked.length) return fail("This chat is closed.", 403);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Write something first.");

    // Chat is free and untimed; the session row is only the digit buffer.
    const session = await ensureChatSession(matchId, user.id);

    const verdict = moderateText(parsed.data.body, {
      context: "chat",
      carryDigits: usableCarry(session),
    });

    if (verdict.action === "block") {
      const sanction = await recordBlock({
        user,
        verdict,
        matchId,
        context: "chat",
      });
      return fail(verdict.message ?? "That message can’t be sent.", 422, {
        moderated: true,
        reasonCode: verdict.reasonCode,
        strikes: sanction.strikes,
        chatBanned: Boolean(
          sanction.chatBannedUntil &&
            sanction.chatBannedUntil.getTime() > Date.now(),
        ),
        suspended: sanction.suspended,
      });
    }

    const [created] = await db
      .insert(messages)
      .values({ matchId, senderId: user.id, body: parsed.data.body.trim() })
      .returning();

    await db
      .update(matches)
      .set({ lastMessageAt: created.createdAt })
      .where(eq(matches.id, matchId));

    // Bank any digits so the next message can be stitched onto them. An empty
    // carry means this message added nothing, so the existing buffer is left
    // alone rather than cleared — clearing it was how a number could be fed
    // through in chunks with a harmless message in between.
    if (verdict.carry) {
      await rememberCarryDigits({ sessionId: session.id, carry: verdict.carry });
    }

    // Tell the other dancer, after the response has gone: the sender never
    // waits on a push service. Only messages that passed moderation get here.
    const recipient = context.partner;
    if (!recipient.suspendedAt) {
      after(() =>
        sendPush(recipient.id, {
          type: "message",
          title: user.name ?? "A dancer",
          body: preview(created.body),
          url: `/chat/${matchId}`,
          tag: `chat-${matchId}`,
          matchId,
          messageId: created.id,
          // Blob avatars only; an inline data URL would overflow the payload.
          icon: user.avatarUrl?.startsWith("https://") ? user.avatarUrl : undefined,
        }),
      );
    }

    return json({
      ok: true,
      message: {
        id: created.id,
        body: created.body,
        mine: true,
        createdAt: created.createdAt,
      },
    });
  });
}
