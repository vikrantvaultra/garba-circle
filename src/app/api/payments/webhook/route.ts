import { NextResponse } from "next/server";
import { settleFromWebhook } from "@/lib/payments";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";

type PaymentEntity = { id: string; order_id: string | null; amount: number; status: string };

/**
 * Razorpay's server-to-server notice that money arrived. It catches payments
 * whose buyer never made it back to the page. Subscribe to payment.captured
 * and order.paid; anything else is acknowledged and ignored.
 *
 * Razorpay retries on any non-2xx, and settling is idempotent, so a repeated
 * delivery is harmless.
 */
export async function POST(req: Request) {
  // The signature covers the exact bytes sent, so read text, not JSON.
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let event: { event?: string; payload?: { payment?: { entity?: PaymentEntity } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  if (
    (event.event === "payment.captured" || event.event === "order.paid") &&
    payment?.order_id &&
    payment.status === "captured"
  ) {
    try {
      const outcome = await settleFromWebhook({
        orderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount,
      });
      return NextResponse.json({ ok: true, outcome });
    } catch (error) {
      // A 500 makes Razorpay retry later, which is what we want if the
      // database blipped.
      console.error("[payments] webhook", error);
      return NextResponse.json({ error: "Try again" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, outcome: "ignored" });
}
