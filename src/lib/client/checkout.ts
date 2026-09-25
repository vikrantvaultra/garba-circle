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
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
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

/**
 * Creates the order, opens Razorpay, then confirms server-side. The grant only
 * ever happens on the server after the signature checks out.
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

  const result = await new Promise<Record<string, string>>((resolve, reject) => {
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
      theme: { color: "#d3002b" },
      handler: (response: Record<string, string>) => resolve(response),
      modal: { ondismiss: () => reject(new CheckoutCancelled()) },
    });
    rzp.open();
  });

  return api.post<ConfirmResponse>("/api/payments/confirm", {
    paymentId: order.paymentId,
    razorpay_order_id: result.razorpay_order_id,
    razorpay_payment_id: result.razorpay_payment_id,
    razorpay_signature: result.razorpay_signature,
  });
}
