"use client";

import { useState } from "react";
import { rupees, type Pack } from "@/lib/constants";

/**
 * Honest value maths. The unit price and the saving are both derived from the
 * real prices, so a "SAVE 26%" badge is arithmetic rather than marketing.
 */
function unitPrice(pack: Pack): number {
  const units = pack.kind === "spins" ? pack.grant : pack.grant / 60;
  return pack.amountPaise / units;
}

function unitLabel(pack: Pack): string {
  const per = unitPrice(pack) / 100;
  return `₹${per.toFixed(per % 1 === 0 ? 0 : 2)} per ${pack.kind === "spins" ? "spin" : "minute"}`;
}
import { CheckoutCancelled, purchasePack } from "@/lib/client/checkout";
import { useToast } from "./Toast";

export function PackSheet({
  open,
  title,
  subtitle,
  packs,
  matchId,
  onClose,
  onPurchased,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  packs: Pack[];
  matchId?: string | null;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  if (!open) return null;

  // The smallest pack is the baseline everything else is compared against.
  const baseline = packs.reduce(
    (cheapest, pack) => (pack.grant < cheapest.grant ? pack : cheapest),
    packs[0],
  );
  const savingFor = (pack: Pack) => {
    const saved = 1 - unitPrice(pack) / unitPrice(baseline);
    return saved >= 0.05 ? Math.round(saved * 100) : 0;
  };

  const buy = async (pack: Pack) => {
    setBusy(pack.key);
    try {
      await purchasePack({ packKey: pack.key, matchId });
      toast.show(`${pack.label} added. Jai Mataji!`, "success");
      onPurchased();
    } catch (error) {
      if (error instanceof CheckoutCancelled) {
        toast.show("Payment cancelled.", "info");
      } else {
        toast.show(
          error instanceof Error ? error.message : "Payment failed.",
          "error",
        );
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-night/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-sheet relative w-full max-w-[460px] rounded-t-[30px] border-t border-gold/30 bg-gradient-to-b from-plum to-night px-5 pt-3 pb-safe shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)]">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-cream/25" />

        <h2 className="font-display text-[23px] font-bold leading-tight">
          {title}
        </h2>
        <p className="mt-1 text-[14.5px] leading-snug text-cream/65">{subtitle}</p>

        <div className="mt-5 space-y-3">
          {packs.map((pack) => (
            <button
              key={pack.key}
              onClick={() => buy(pack)}
              disabled={busy !== null}
              className="panel relative flex w-full items-center gap-4 p-4 text-left transition-transform active:scale-[0.985] disabled:opacity-60"
            >
              {savingFor(pack) > 0 ? (
                <span className="absolute -top-2 right-4 rounded-full bg-gradient-to-r from-peacock to-royal px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-night">
                  SAVE {savingFor(pack)}%
                </span>
              ) : pack.badge ? (
                <span className="absolute -top-2 right-4 rounded-full bg-gradient-to-r from-rani to-magenta px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
                  {pack.badge}
                </span>
              ) : null}
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-marigold/30 to-rani/20 text-xl">
                {pack.kind === "spins" ? "\u{1F3B0}" : "⏱️"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[17px] font-bold">
                  {pack.label}
                </div>
                <div className="text-[13px] text-cream/60">{pack.sublabel}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="gold-text font-display text-[21px] font-extrabold">
                  {busy === pack.key ? "…" : rupees(pack.amountPaise)}
                </div>
                <div className="text-[11px] font-medium text-cream/45">
                  {unitLabel(pack)}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-cream/45">
          Secure UPI, card and wallet payments. One-time purchase, no
          subscription, no auto-debit.
        </p>

        <button onClick={onClose} className="btn-ghost mt-3 mb-2">
          Maybe later
        </button>
      </div>
    </div>
  );
}
