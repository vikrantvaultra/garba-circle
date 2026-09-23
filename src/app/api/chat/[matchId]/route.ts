import { and, eq } from "drizzle-orm";
import { fail, guard, json, publicProfile } from "@/lib/api";
import { db } from "@/lib/db";
import { blocks } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { loadMatchFor } from "@/lib/chat/match";
import { isChatBanned } from "@/lib/moderation/record";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  return guard(async () => {
    const user = await requireUser();
    const { matchId } = await ctx.params;

    const context = await loadMatchFor(user.id, matchId);
    if (!context) return fail("Chat not found.", 404);

    const blocked = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, context.partner.id)),
      )
      .limit(1);

    return json({
      matchId,
      partner: publicProfile(context.partner),
      chatBanned: isChatBanned(user),
      chatBannedUntil: user.chatBannedUntil,
      youBlockedThem: blocked.length > 0,
    });
  });
}
