import { z } from "zod";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createOrder } from "@/lib/payments";
import { UNLIMITED_PASS_ENDS_LABEL, packsOnSale } from "@/lib/constants";
import { hasUnlimited } from "@/lib/search/engine";

const Body = z.object({
  packKey: z.string().min(2).max(24),
});

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Pick a pack first.");

    if (!rateLimit(`order:${user.id}`, 10, 60 * 1000)) {
      return fail("Too many attempts. Try again in a minute.", 429);
    }

    const pack = packsOnSale().find((p) => p.key === parsed.data.packKey);
    if (!pack) return fail("That pack isn't on sale.");
    if (pack.unlimited && hasUnlimited(user)) {
      return fail(`You already have unlimited spins till ${UNLIMITED_PASS_ENDS_LABEL}.`, 409);
    }

    const order = await createOrder({ userId: user.id, packKey: pack.key });

    return json({
      ok: true,
      paymentId: order.paymentId,
      provider: order.provider,
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      keyId: order.keyId,
      pack: order.pack,
      prefill: { contact: user.phone, name: user.name ?? "" },
    });
  });
}
