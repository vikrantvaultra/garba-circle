import { z } from "zod";
import { fail, guard, json } from "@/lib/api";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";

const Body = z.object({
  reportedId: z.string().uuid(),
  matchId: z.string().uuid().optional().nullable(),
  reason: z.enum([
    "abusive",
    "sexual",
    "asking_contact",
    "fake_profile",
    "spam",
    "other",
  ]),
  details: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Pick a reason for the report.");
    if (parsed.data.reportedId === user.id) return fail("You can’t report yourself.");

    await db.insert(reports).values({
      reporterId: user.id,
      reportedId: parsed.data.reportedId,
      matchId: parsed.data.matchId ?? null,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    });

    return json({ ok: true });
  });
}
