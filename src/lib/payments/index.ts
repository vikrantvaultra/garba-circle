/**
 * Payment orchestration: create an order, verify it, then grant what was
 * bought — exactly once.
 *
 * Without Razorpay keys the app falls back to a simulated gateway so the whole
 * flow is testable locally. That fallback refuses to run in production, so a
 * missing key can never turn into free credits on a live site.
 */

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, users, type Payment } from "@/lib/db/schema";
import { UNLIMITED_PASS_ENDS_AT, findPack, packsOnSale, type Pack } from "@/lib/constants";
import { devPaymentsAllowed, isProduction } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import {
  createRazorpayOrder,
  findCapturedPayment,
  razorpayConfigured,
  razorpayKeyId,
  verifyRazorpaySignature,
} from "./razorpay";

export type Provider = "razorpay" | "mock";

export function activeProvider(): Provider {
  return razorpayConfigured() ? "razorpay" : "mock";
}

export { isProduction };

export class PaymentConfigError extends Error {}

export type CreatedOrder = {
  paymentId: string;
  provider: Provider;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  /** Razorpay publishable key, for the checkout script. Empty in mock mode. */
  keyId: string;
  pack: Pack;
};

export async function createOrder(input: {
  userId: string;
  packKey: string;
}): Promise<CreatedOrder> {
  // Only packs on sale can be ordered; retired ones are still honoured on
  // confirmation for orders placed before they were retired.
  const pack = packsOnSale().find((p) => p.key === input.packKey);
  if (!pack) throw new PaymentConfigError("That pack isn't on sale.");

  const provider = activeProvider();
  if (provider === "mock" && !devPaymentsAllowed()) {
    throw new PaymentConfigError(
      "Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }

  const [row] = await db
    .insert(payments)
    .values({
      userId: input.userId,
      packKey: pack.key,
      kind: pack.kind,
      amountPaise: pack.amountPaise,
      provider,
      status: "created",
    })
    .returning();

  let orderId: string;
  if (provider === "razorpay") {
    const order = await createRazorpayOrder({
      amountPaise: pack.amountPaise,
      receipt: row.id,
      notes: { packKey: pack.key, userId: input.userId },
    });
    orderId = order.id;
  } else {
    orderId = `mock_order_${row.id}`;
  }

  await db
    .update(payments)
    .set({ providerOrderId: orderId })
    .where(eq(payments.id, row.id));

  return {
    paymentId: row.id,
    provider,
    orderId,
    amountPaise: pack.amountPaise,
    currency: "INR",
    keyId: provider === "razorpay" ? razorpayKeyId() : "",
    pack,
  };
}

export type ConfirmResult =
  | { ok: true; pack: Pack; alreadyApplied: boolean }
  | { ok: false; reason: string };

export async function confirmOrder(input: {
  userId: string;
  paymentId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}): Promise<ConfirmResult> {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, input.paymentId), eq(payments.userId, input.userId)))
    .limit(1);

  if (!row) return { ok: false, reason: "Payment not found" };

  const pack = findPack(row.packKey);
  if (!pack) return { ok: false, reason: "Unknown pack" };

  // Replaying a confirmation must not grant the pack twice.
  if (row.status === "paid") return { ok: true, pack, alreadyApplied: true };

  if (row.provider === "razorpay") {
    const valid =
      Boolean(input.razorpayOrderId) &&
      Boolean(input.razorpayPaymentId) &&
      input.razorpayOrderId === row.providerOrderId &&
      verifyRazorpaySignature({
        orderId: input.razorpayOrderId!,
        paymentId: input.razorpayPaymentId!,
        signature: input.razorpaySignature ?? "",
      });

    // Not marked failed: the money may still have moved, and the status poll
    // or the webhook can settle the order from Razorpay's side.
    if (!valid) return { ok: false, reason: "Payment could not be verified" };
  } else if (!devPaymentsAllowed()) {
    return { ok: false, reason: "Payments are not configured" };
  }

  const applied = await settle(row, input.razorpayPaymentId ?? `mock_pay_${row.id}`);
  return { ok: true, pack, alreadyApplied: !applied };
}

export type PaymentStatus =
  | { status: "paid"; pack: Pack }
  | { status: "pending" }
  | { status: "unknown" };

/**
 * For the client polling after checkout. If we haven't heard the order was
 * paid, ask Razorpay — at most once every few seconds per order, so a page
 * left polling can't burn through the API rate limit.
 */
export async function reconcileOrder(input: {
  userId: string;
  paymentId: string;
}): Promise<PaymentStatus> {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, input.paymentId), eq(payments.userId, input.userId)))
    .limit(1);
  if (!row) return { status: "unknown" };

  const pack = findPack(row.packKey);
  if (!pack) return { status: "unknown" };
  if (row.status === "paid") return { status: "paid", pack };
  if (row.provider !== "razorpay" || !row.providerOrderId) return { status: "pending" };
  if (!rateLimit(`rzp-check:${row.id}`, 1, 5_000)) return { status: "pending" };

  const captured = await findCapturedPayment(row.providerOrderId);
  if (!captured || captured.amount !== row.amountPaise) return { status: "pending" };

  await settle(row, captured.id);
  return { status: "paid", pack };
}

/**
 * Called from the webhook. Razorpay keys can be shared with other sites, so
 * orders this app didn't create are ignored rather than treated as errors.
 */
export async function settleFromWebhook(input: {
  orderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
}): Promise<"applied" | "already" | "ignored"> {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.providerOrderId, input.orderId), eq(payments.provider, "razorpay")))
    .limit(1);
  if (!row || !findPack(row.packKey)) return "ignored";
  if (input.amountPaise !== row.amountPaise) {
    console.error("[payments] webhook amount mismatch", input.orderId);
    return "ignored";
  }
  return (await settle(row, input.razorpayPaymentId)) ? "applied" : "already";
}

/**
 * Marks the order paid and grants the pack in one transaction. The checkout
 * callback, the status poll and the webhook can all arrive at once; only the
 * one whose update flips the row to "paid" grants anything.
 *
 * Returns whether this call was the one that applied it.
 */
async function settle(row: Payment, providerPaymentId: string): Promise<boolean> {
  const pack = findPack(row.packKey);
  if (!pack) return false;

  return db.transaction(async (tx) => {
    const flipped = await tx
      .update(payments)
      .set({ status: "paid", paidAt: new Date(), providerPaymentId })
      .where(and(eq(payments.id, row.id), ne(payments.status, "paid")))
      .returning({ id: payments.id });
    if (flipped.length === 0) return false;

    await grantPack(tx, { userId: row.userId, pack });
    return true;
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Packs only ever buy spins; chat is free. */
async function grantPack(tx: Tx, input: { userId: string; pack: Pack }): Promise<void> {
  if (input.pack.unlimited) {
    // Buying the pass twice doesn't stack; it runs to the same end.
    await tx
      .update(users)
      .set({
        unlimitedUntil: sql`greatest(coalesce(${users.unlimitedUntil}, now()), ${UNLIMITED_PASS_ENDS_AT.toISOString()}::timestamptz)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));
    return;
  }
  await tx
    .update(users)
    .set({
      paidSpins: sqlAdd("paid_spins", input.pack.grant),
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId));
}

/**
 * An in-database increment, so two confirmations arriving at once cannot read
 * the same value and lose one of the grants.
 */
function sqlAdd(column: string, amount: number) {
  return sql`${sql.identifier(column)} + ${amount}`;
}
