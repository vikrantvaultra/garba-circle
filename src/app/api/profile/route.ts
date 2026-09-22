import { z } from "zod";
import { eq } from "drizzle-orm";
import { fail, guard, json } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { moderateText } from "@/lib/moderation";
import { recordBlock } from "@/lib/moderation/record";
import { DANCE_STYLES, GENDERS, SKILL_LEVELS } from "@/lib/constants";

const Body = z.object({
  name: z.string().trim().min(2).max(40),
  gender: z.enum(GENDERS.map((g) => g.key) as [string, ...string[]]),
  age: z.number().int().min(16).max(80),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().max(60).optional().nullable(),
  bio: z.string().trim().max(240).optional().nullable(),
  danceStyles: z.array(z.enum(DANCE_STYLES as unknown as [string, ...string[]])).max(7),
  skillLevel: z.enum(SKILL_LEVELS.map((s) => s.key) as [string, ...string[]]),
});

export async function PUT(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const first = parsed.error?.issues?.[0];
      return fail(first?.message ?? "Please check the form and try again.");
    }
    const data = parsed.data;

    // A bio is a perfect place to hide a phone number, so it gets the same
    // treatment as a chat message.
    for (const [field, value] of [
      ["name", data.name],
      ["bio", data.bio ?? ""],
    ] as const) {
      if (!value) continue;
      const verdict = moderateText(value, { context: "profile" });
      if (verdict.action === "block") {
        await recordBlock({ user, verdict, context: "profile" });
        return fail(
          verdict.message ?? "That text isn’t allowed.",
          400,
          { field },
        );
      }
    }

    await db
      .update(users)
      .set({
        name: data.name,
        gender: data.gender,
        age: data.age,
        city: data.city,
        state: data.state ?? null,
        bio: data.bio ?? null,
        danceStyles: data.danceStyles,
        skillLevel: data.skillLevel,
        profileComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return json({ ok: true });
  });
}
