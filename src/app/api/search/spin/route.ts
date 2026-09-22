import { z } from "zod";
import { fail, guard, json, publicProfile, rateLimit } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import {
  consumeSpin,
  pickPartner,
  quotaFor,
  recordSpin,
} from "@/lib/search/engine";
import { SPIN_PACKS } from "@/lib/constants";

const Body = z.object({
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  city: z.string().trim().max(60).optional().nullable(),
});

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (!user.profileComplete) {
      return fail("Finish your profile first.", 400, { needsProfile: true });
    }
    if (!rateLimit(`spin:${user.id}`, 30, 60 * 1000)) {
      return fail("Slow down a moment.", 429);
    }

    const parsed = Body.safeParse((await req.json().catch(() => ({}))) ?? {});
    const filters = parsed.success ? parsed.data : { gender: null, city: null };

    const quota = quotaFor(user);
    if (quota.totalRemaining <= 0) {
      return fail("Your free searches are done.", 402, {
        needsPack: true,
        packs: SPIN_PACKS,
        quota,
      });
    }

    // City is free for everyone; gender is what a pack buys. A free pull in
    // your own city is still a surprise, just not a pointless one.
    const allowGender = quota.freeRemaining === 0 && quota.paidRemaining > 0;
    const city = filters.city?.trim() || null;
    const gender = allowGender ? (filters.gender ?? null) : null;

    const partner = await pickPartner({ user, gender, city, allowGender });

    if (!partner) {
      // Nothing was spent, so say so plainly.
      return fail(
        city
          ? `No one is dancing in ${city} right now. Try another city.`
          : "The circle is still filling up. Try again in a little while.",
        404,
        { emptyPool: true, charged: false },
      );
    }

    const { paid } = await consumeSpin(user);
    await recordSpin({
      userId: user.id,
      shownUserId: partner.id,
      paid,
      gender,
      city,
    });

    const after = quotaFor({
      ...user,
      freeSpinsUsed: paid ? user.freeSpinsUsed : user.freeSpinsUsed + 1,
      paidSpins: paid ? user.paidSpins - 1 : user.paidSpins,
    });

    return json({
      ok: true,
      partner: publicProfile(partner),
      genderFilterApplied: Boolean(gender),
      cityFilterApplied: Boolean(city),
      quota: after,
    });
  });
}
