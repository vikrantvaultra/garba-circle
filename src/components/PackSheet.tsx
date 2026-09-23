"use client";

import { useRef, useState, type ReactNode } from "react";
import { rupees, type Pack } from "@/lib/constants";
import { CheckoutCancelled, purchasePack } from "@/lib/client/checkout";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

/**
 * Honest value maths. The unit price and the saving are both derived from the
 * real prices, so a "save 26%" badge is arithmetic rather than marketing.
 */
function unitPrice(pack: Pack): number {
  const units = pack.kind === "spins" ? pack.grant : pack.grant / 60;
  return pack.amountPaise / units;
}

function unitLabel(pack: Pack): string {
  const per = unitPrice(pack) / 100;
  return `₹${per.toFixed(per % 1 === 0 ? 0 : 2)} a ${pack.kind === "spins" ? "spin" : "minute"}`;
}

export function PackSheet({
  open,
  title,
  subtitle,
  packs,
  matchId,
  teaser,
  footer,
  onClose,
  onPurchased,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  packs: Pack[];
  matchId?: string | null;
  /** A highlighted line about what a pack gets you. */
  teaser?: ReactNode;
  /** Anything free that sits under the paid options. */
  footer?: ReactNode;
  onClose: () => void;
  onPurchased: (pack: Pack) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(
    () => (packs.find((p) => p.badge) ?? packs[packs.length - 1]).key,
  );
  const payRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();

  const selected = packs.find((p) => p.key === chosen) ?? packs[0];

  // The smallest pack is the baseline everything else is compared against.
  const baseline = packs.reduce(
    (cheapest, pack) => (pack.grant < cheapest.grant ? pack : cheapest),
    packs[0],
  );
  const savingFor = (pack: Pack) => {
    const saved = 1 - unitPrice(pack) / unitPrice(baseline);
    return saved >= 0.05 ? Math.round(saved * 100) : 0;
  };

  const buy = async () => {
    setBusy(true);
    try {
      await purchasePack({ packKey: selected.key, matchId });
      toast.show(`${selected.label} added. Jai Mataji!`, "success");
      onPurchased(selected);
    } catch (error) {
      if (error instanceof CheckoutCancelled) {
        toast.show("Payment cancelled.", "info");
      } else {
        toast.show(error instanceof Error ? error.message : "Payment failed.", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} labelledBy="packs-title" initialFocus={payRef}>
      <h2 id="packs-title" className="font-display text-[32px] leading-[1.1]">
        {title}
      </h2>
      <p className="mt-1.5 text-[15px] leading-normal text-muted">{subtitle}</p>

      {teaser && (
        <div className="mt-[18px] flex items-center gap-3.5 rounded-2xl border border-rani/35 bg-rani/10 p-3.5 text-[14px] leading-[1.45]">
          {teaser}
        </div>
      )}

      <div role="radiogroup" aria-label="Packs" className="mt-[18px] grid gap-2.5">
        {packs.map((pack) => {
          const on = pack.key === selected.key;
          const saving = savingFor(pack);
          return (
            <label
              key={pack.key}
              className={`relative flex cursor-pointer items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cream ${
                on ? "border-marigold bg-marigold/10" : "border-white/12 bg-deep/50"
              }`}
            >
              <input
                type="radio"
                name="pack"
                value={pack.key}
                checked={on}
                onChange={() => setChosen(pack.key)}
                className="absolute opacity-0"
              />
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  on ? "border-marigold" : "border-white/30"
                }`}
              >
                {on && <span className="h-2.5 w-2.5 rounded-full bg-marigold" />}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[16px]">{pack.label}</b>
                <small className="text-[13px] text-muted">
                  {unitLabel(pack)}
                  {saving > 0 ? `, save ${saving}%` : ""}
                </small>
              </span>
              <span className="font-display text-[22px]">{rupees(pack.amountPaise)}</span>
            </label>
          );
        })}
      </div>

      <button
        ref={payRef}
        type="button"
        onClick={buy}
        disabled={busy}
        className="btn-primary active:btn-primary-active mt-4 min-h-[56px] disabled:opacity-60"
      >
        {busy ? "Opening payment…" : `Pay ${rupees(selected.amountPaise)}`}
      </button>
      <p className="mt-2.5 text-center text-[12px] text-muted">
        One-time payment by UPI or card. Nothing renews automatically.
      </p>

      {footer && (
        <div className="mt-[18px] grid gap-2.5 border-t border-white/8 pt-4">{footer}</div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mx-auto mt-3 block min-h-[44px] px-4 text-[14px] font-semibold text-muted"
      >
        Maybe later
      </button>
    </Sheet>
  );
}
