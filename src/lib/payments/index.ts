/**
 * Payment orchestration: create an order, verify it, then grant what was
 * bought — exactly once.
 *
 * Without Razorpay keys the app falls back to a simulated gateway so the whole
 * flow is testable locally. That fallback refuses to run in production, so a
 * missing key can never turn into free credits on a live site.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, users } from "@/lib/db/schema";
import { findPack, type Pack } from "@/lib/constants";
import { devPaymentsAllowed, isProduction } from "@/lib/env";
import {
  createRazorpayOrder,
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
  const pack = findPack(input.packKey);
  if (!pack) throw new PaymentConfigError("Unknown pack");

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

    if (!valid) {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, row.id));
      return { ok: false, reason: "Payment could not be verified" };
    }
  } else if (!devPaymentsAllowed()) {
    return { ok: false, reason: "Payments are not configured" };
  }

  await grantPack({ userId: row.userId, pack });

  await db
    .update(payments)
    .set({
      status: "paid",
      paidAt: new Date(),
      providerPaymentId: input.razorpayPaymentId ?? `mock_pay_${row.id}`,
    })
    .where(eq(payments.id, row.id));

  return { ok: true, pack, alreadyApplied: false };
}

/** Packs only ever buy spins; chat is free. */
async function grantPack(input: { userId: string; pack: Pack }): Promise<void> {
  await db
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
