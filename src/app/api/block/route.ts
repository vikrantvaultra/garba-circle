import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { fail, guard, json } from "@/lib/api";
import { db } from "@/lib/db";
import { blocks } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";

const Body = z.object({
  blockedId: z.string().uuid(),
  /** false un-blocks. */
  blocked: z.boolean().default(true),
});

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.");
    if (parsed.data.blockedId === user.id) return fail("You can’t block yourself.");

    if (parsed.data.blocked) {
      await db
        .insert(blocks)
        .values({ blockerId: user.id, blockedId: parsed.data.blockedId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(blocks)
        .where(
          and(
            eq(blocks.blockerId, user.id),
            eq(blocks.blockedId, parsed.data.blockedId),
          ),
        );
    }

    return json({ ok: true, blocked: parsed.data.blocked });
  });
}
