import webpush, { WebPushError } from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

/**
 * Web push: the notification a phone shows when someone messages you and the
 * app isn't open. Needs a VAPID key pair (`npx web-push generate-vapid-keys`)
 * and a contact for the push services:
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *
 * Without them push is simply off: the app never offers it, and sending is a
 * no-op. Chats keep working and still show new messages in the app.
 */

export type PushPayload = {
  type: "message";
  /** Shown as the notification title: who wrote. */
  title: string;
  body: string;
  /** Where a tap on the notification goes. */
  url: string;
  /** One notification per conversation; a newer message replaces it. */
  tag: string;
  matchId: string;
  messageId: string;
  icon?: string;
};

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    console.error("[push] bad VAPID settings", error);
    configured = false;
  }
  return configured;
}

/** Save (or move to this user) the browser's subscription. */
export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
) {
  const now = new Date();
  await db
    .insert(pushSubscriptions)
    .values({ userId, ...sub, updatedAt: now })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.p256dh, auth: sub.auth, updatedAt: now },
    });
}

export async function removeSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * Send to every browser this person has turned notifications on in. Never
 * throws: a notification that can't be delivered must not fail the message
 * that caused it. Subscriptions the push service says are gone (the person
 * cleared site data, or revoked permission) are deleted.
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<void> {
  if (!pushConfigured()) return;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            {
              // A message is stale after a night of garba.
              TTL: 12 * 60 * 60,
              urgency: "high",
              // A phone that's offline gets only the latest per conversation.
              // Topics are at most 32 URL-safe characters: the uuid's hex.
              topic: payload.matchId.replace(/-/g, "").slice(0, 32),
            },
          );
        } catch (error) {
          if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
            dead.push(sub.id);
          } else {
            console.error("[push] send failed", error instanceof WebPushError ? error.statusCode : error);
          }
        }
      }),
    );
    if (dead.length) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
    }
  } catch (error) {
    console.error("[push]", error);
  }
}
