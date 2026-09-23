import { z } from "zod";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { pushConfigured, removeSubscription, saveSubscription } from "@/lib/push";

const Subscription = z.object({
  endpoint: z.url().max(1000).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/** This browser wants message notifications for the signed-in dancer. */
export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (!pushConfigured()) return fail("Notifications aren’t set up yet.", 503);
    if (!rateLimit(`push:${user.id}`, 20, 60 * 1000)) {
      return fail("Too many requests. Try again in a minute.", 429);
    }
    const parsed = Subscription.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("That subscription isn’t valid.");
    const { endpoint, keys } = parsed.data;
    await saveSubscription(user.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
    return json({ ok: true });
  });
}

/** Stop notifying this browser: turned off, or signing out. */
export async function DELETE(req: Request) {
  return guard(async () => {
    await requireUser();
    const parsed = z
      .object({ endpoint: z.string().min(1).max(1000) })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Missing endpoint.");
    await removeSubscription(parsed.data.endpoint);
    return json({ ok: true });
  });
}
