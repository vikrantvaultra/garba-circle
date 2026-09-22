import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { db } from "@/lib/db";
import { blocks, interests, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { createMatch, findMatchBetween } from "@/lib/chat/match";

const Body = z.object({ toUserId: z.string().uuid() });

/**
 * Sending a dandiya opens the conversation straight away.
 *
 * There is no accept step: a spin already cost something, which is the rate
 * limit, and the recipient keeps block, report and their own free chat time.
 * The interest row is still written so we know who reached out first, which is
 * what lets the other side see "they sent you a dandiya".
 */
export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Who did you want to invite?");
    const toUserId = parsed.data.toUserId;

    if (toUserId === user.id) return fail("You can’t invite yourself.");
    if (!rateLimit(`interest:${user.id}`, 40, 60 * 1000)) {
      return fail("Slow down a moment.", 429);
    }

    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, toUserId))
      .limit(1);
    if (!target || !target.profileComplete || target.suspendedAt) {
      return fail("That dancer is no longer available.", 404);
    }

    const blocked = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(and(eq(blocks.blockerId, toUserId), eq(blocks.blockedId, user.id)))
      .limit(1);
    if (blocked.length) return fail("That dancer is no longer available.", 404);

    const existing = await findMatchBetween(user.id, toUserId);
    if (existing) {
      return json({ ok: true, matchId: existing.id, alreadyOpen: true });
    }

    await db
      .insert(interests)
      .values({ fromUserId: user.id, toUserId, status: "accepted", respondedAt: new Date() })
      .onConflictDoNothing();

    const match = await createMatch(user.id, toUserId);
    return json({ ok: true, matchId: match.id, alreadyOpen: false });
  });
}
