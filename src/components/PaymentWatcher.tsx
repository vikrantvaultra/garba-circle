"use client";

import { useEffect } from "react";
import { ApiFailure } from "@/lib/client/api";
import {
  PENDING_EVENT,
  PURCHASED_EVENT,
  checkPayment,
  forgetPending,
  readPending,
} from "@/lib/client/checkout";
import { useToast } from "./Toast";

/** Keep checking a little while after checkout closes; after that the webhook has it. */
const POLL_FOR_MS = 3 * 60 * 1000;
const POLL_EVERY_MS = 5000;

/**
 * Finishes payments this page never heard back about. A buyer who pays in
 * their UPI app often returns to a reloaded tab, or closes checkout before
 * the capture lands; without this they would pay and see nothing happen
 * until the next time the screen fetched their balance.
 */
export function PaymentWatcher() {
  const toast = useToast();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const tick = async () => {
      timer = undefined;
      const pending = readPending();
      if (stopped || !pending || document.visibilityState !== "visible") return;

      let status;
      try {
        status = await checkPayment(pending.paymentId);
      } catch (error) {
        // Signed out: try again once they're back in.
        if (error instanceof ApiFailure && error.status === 401) return;
        status = null;
      }
      if (stopped) return;

      if (status?.status === "paid") {
        forgetPending(pending.paymentId);
        toast.show(`${status.pack.label} added. Jai Mataji!`, "success");
        window.dispatchEvent(new CustomEvent(PURCHASED_EVENT, { detail: status }));
        return;
      }
      if (status?.status === "unknown") {
        forgetPending(pending.paymentId);
        return;
      }
      if (Date.now() - pending.at < POLL_FOR_MS) {
        timer = setTimeout(tick, POLL_EVERY_MS);
      }
    };

    const kick = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };

    kick();
    document.addEventListener("visibilitychange", kick);
    window.addEventListener(PENDING_EVENT, kick);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", kick);
      window.removeEventListener(PENDING_EVENT, kick);
    };
  }, [toast]);

  return null;
}
