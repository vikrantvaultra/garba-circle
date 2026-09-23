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

/**
 * Every spin says where and who. "both" means no gender filter, so dancers
 * who chose "other" on their profile are never left out of a search.
 */
const Body = z.object({
  gender: z.enum(["female", "male", "both"]),
  city: z.string().trim().min(1).max(80),
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

    const quota = quotaFor(user);
    if (quota.totalRemaining <= 0) {
      return fail("Your free searches are done.", 402, {
        needsPack: true,
        packs: SPIN_PACKS,
        quota,
      });
    }

    const parsed = Body.safeParse((await req.json().catch(() => ({}))) ?? {});
    if (!parsed.success) {
      return fail("Choose a city and who you'd like to meet first.", 400, {
        needsFilters: true,
      });
    }

    // Filters cost nothing: the same city and gender choice applies to free
    // and paid spins alike. A pack only buys more spins.
    const city = parsed.data.city;
    const gender = parsed.data.gender === "both" ? null : parsed.data.gender;

    const partner = await pickPartner({ user, gender, city });

    if (!partner) {
      // Nothing was spent, so say so plainly.
      const who = gender === "female" ? "No women" : gender === "male" ? "No men" : "No one";
      return fail(
        `${who} dancing in ${city} right now. Try another city.`,
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
