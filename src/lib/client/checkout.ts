"use client";

import { api } from "./api";
import type { Pack } from "@/lib/constants";

type OrderResponse = {
  paymentId: string;
  provider: "razorpay" | "mock";
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  pack: Pack;
  prefill: { contact: string; name: string };
};

type ConfirmResponse = {
  ok: true;
  pack: Pack;
  quota?: unknown;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; close: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export class CheckoutCancelled extends Error {
  constructor() {
    super("Payment cancelled");
  }
}

export type StatusResponse =
  | { status: "paid"; pack: Pack; quota?: unknown }
  | { status: "pending" | "unknown" };

export const checkPayment = (paymentId: string) =>
  api.get<StatusResponse>(`/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`);

/*
 * The last order opened in checkout, kept so <PaymentWatcher> can finish it if
 * this page never hears back: the tab was reloaded or killed while the buyer
 * was in their UPI app, or they closed checkout before the capture landed.
 */
const PENDING_KEY = "garba:pending-payment";
/** How long a pending order is worth checking on. */
export const PENDING_TTL_MS = 30 * 60 * 1000;
/** Fired on window once a pending order turns out to be paid. */
export const PURCHASED_EVENT = "garba:purchased";
/** Fired on window when checkout ends without a confirmed payment. */
export const PENDING_EVENT = "garba:payment-pending";

export type PendingPayment = { paymentId: string; at: number };

/** The order checkout is handling right now; the watcher leaves it alone. */
let activePaymentId: string | null = null;

export function readPending(): PendingPayment | null {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as PendingPayment | null;
    if (!value || value.paymentId === activePaymentId) return null;
    if (Date.now() - value.at > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function rememberPending(paymentId: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ paymentId, at: Date.now() }));
  } catch {
    /* private mode: the webhook still credits the account */
  }
}

export function forgetPending(paymentId: string) {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as PendingPayment | null;
    if (value?.paymentId === paymentId) localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to forget */
  }
}

/**
 * Creates the order, opens Razorpay, then confirms server-side. The grant only
 * ever happens on the server after the signature checks out, or after Razorpay
 * itself says the order was paid.
 *
 * On phones the success callback often never runs (the buyer switches to a
 * UPI app and the page is frozen or reloaded), so while checkout is open the
 * order's status is also polled, and checked once more when it is dismissed.
 *
 * With no Razorpay keys configured the order is confirmed directly — a local
 * development path that the server refuses to take in production.
 */
export async function purchasePack(input: {
  packKey: string;
}): Promise<ConfirmResponse> {
  const order = await api.post<OrderResponse>("/api/payments/create-order", {
    packKey: input.packKey,
  });

  if (order.provider === "mock") {
    return api.post<ConfirmResponse>("/api/payments/confirm", {
      paymentId: order.paymentId,
    });
  }

  await loadRazorpay();

  const { paymentId } = order;
  activePaymentId = paymentId;
  rememberPending(paymentId);

  try {
    const result = await new Promise<ConfirmResponse>((resolve, reject) => {
      let done = false;
      const finish = (settle: () => void) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        settle();
      };

      const paidAlready = async () => {
        const status = await checkPayment(paymentId).catch(() => null);
        if (status?.status !== "paid") return false;
        finish(() => {
          rzp.close();
          resolve({ ok: true, pack: status.pack, quota: status.quota });
        });
        return true;
      };

      const onVisible = () => {
        if (document.visibilityState === "visible") void paidAlready();
      };

      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Havmor Garba Circle",
        description: order.pack.label,
        order_id: order.orderId,
        prefill: {
          contact: order.prefill.contact,
          name: order.prefill.name,
        },
        notes: { paymentId },
        theme: { color: "#d3002b" },
        handler: async (response: Record<string, string>) => {
          try {
            const confirmed = await api.post<ConfirmResponse>("/api/payments/confirm", {
              paymentId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            finish(() => resolve(confirmed));
          } catch (error) {
            if (!(await paidAlready())) finish(() => reject(error));
          }
        },
        modal: {
          ondismiss: async () => {
            if (!(await paidAlready())) finish(() => reject(new CheckoutCancelled()));
          },
        },
      });

      rzp.open();
      const timer = setInterval(() => {
        if (document.visibilityState === "visible") void paidAlready();
      }, 4000);
      document.addEventListener("visibilitychange", onVisible);
    });

    forgetPending(paymentId);
    return result;
  } catch (error) {
    // A dismissed or unverified checkout may still have taken the money; the
    // capture can land a few seconds later. Let the watcher keep an eye on it.
    activePaymentId = null;
    window.dispatchEvent(new Event(PENDING_EVENT));
    throw error;
  } finally {
    activePaymentId = null;
  }
}
