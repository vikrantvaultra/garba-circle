import { z } from "zod";
import { eq } from "drizzle-orm";
import { fail, guard, json } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { confirmOrder } from "@/lib/payments";
import { quotaFor } from "@/lib/search/engine";

const Body = z.object({
  paymentId: z.string().uuid(),
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid payment confirmation.");

    const result = await confirmOrder({
      userId: user.id,
      paymentId: parsed.data.paymentId,
      razorpayOrderId: parsed.data.razorpay_order_id,
      razorpayPaymentId: parsed.data.razorpay_payment_id,
      razorpaySignature: parsed.data.razorpay_signature,
    });

    if (!result.ok) return fail(result.reason, 400);

    // Re-read so the client gets the balance it just paid for.
    const [fresh] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    return json({
      ok: true,
      pack: result.pack,
      quota: quotaFor(fresh),
    });
  });
}
