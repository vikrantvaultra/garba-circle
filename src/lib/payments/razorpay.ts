/**
 * Razorpay REST calls. Deliberately no SDK — order creation is one POST and
 * signature verification is one HMAC, and skipping the dependency keeps the
 * function bundle small.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export type RazorpayOrder = { id: string; amount: number; currency: string };

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });

  if (!res.ok) {
    throw new Error(`Razorpay order failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Razorpay signs "<order_id>|<payment_id>" with the key secret. */
export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature ?? "", "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Razorpay ${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/**
 * Asks Razorpay whether an order has been paid, for when neither the checkout
 * callback nor the webhook has told us. On phones the callback often never
 * fires: the buyer switches to their UPI app, pays, and the browser tab that
 * was waiting is gone or frozen by the time they come back.
 *
 * Returns the captured payment, or null while the order is still unpaid.
 */
export async function findCapturedPayment(
  orderId: string,
): Promise<{ id: string; amount: number } | null> {
  const order = await get<{ status: string; amount_paid: number }>(`/orders/${orderId}`);
  if (order.status !== "paid") return null;
  const { items } = await get<{ items: { id: string; status: string; amount: number }[] }>(
    `/orders/${orderId}/payments`,
  );
  const captured = items.find((p) => p.status === "captured");
  return captured ? { id: captured.id, amount: captured.amount } : null;
}

/**
 * Webhooks are signed over the raw request body with the webhook's own
 * secret, which is set per webhook in the dashboard and is not the key secret.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
