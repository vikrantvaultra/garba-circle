import { eq } from "drizzle-orm";
import { fail, guard, json } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { reconcileOrder } from "@/lib/payments";
import { quotaFor } from "@/lib/search/engine";

/**
 * Polled while checkout is open and after the buyer comes back from their UPI
 * app, because the checkout callback alone can't be trusted to fire on phones.
 */
export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const paymentId = new URL(req.url).searchParams.get("paymentId") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return fail("Invalid payment.");

    const result = await reconcileOrder({ userId: user.id, paymentId });
    if (result.status !== "paid") return json({ status: result.status });

    const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    return json({ status: "paid", pack: result.pack, quota: quotaFor(fresh) });
  });
}
