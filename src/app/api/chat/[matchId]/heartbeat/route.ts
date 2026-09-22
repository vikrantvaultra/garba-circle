import { z } from "zod";
import { fail, guard, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { loadMatchFor } from "@/lib/chat/match";
import { tickChatSession } from "@/lib/chat/billing";

const Body = z.object({ active: z.boolean() });

/**
 * Called by the open chat screen every few seconds. `active: false` (tab
 * hidden, or no typing for a while) re-anchors the clock without billing,
 * which is what makes "the meter stops when you stop" true.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  return guard(async () => {
    const user = await requireUser();
    const { matchId } = await ctx.params;

    const context = await loadMatchFor(user.id, matchId);
    if (!context) return fail("Chat not found.", 404);

    const parsed = Body.safeParse(await req.json().catch(() => ({ active: true })));
    const active = parsed.success ? parsed.data.active : true;

    const meter = await tickChatSession({ matchId, userId: user.id, active });
    return json({ ok: true, meter });
  });
}
