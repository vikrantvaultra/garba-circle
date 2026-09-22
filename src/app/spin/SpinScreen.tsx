"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SlotMachine, TOTAL_SPIN_MS } from "@/components/SlotMachine";
import { ProfileCard, type PublicProfile } from "@/components/ProfileCard";
import { PackSheet } from "@/components/PackSheet";
import { BottomNav } from "@/components/BottomNav";
import { CircleLive } from "@/components/CircleLive";
import { FirstRunGuide } from "@/components/FirstRunGuide";
import { useToast } from "@/components/Toast";
import { api, ApiFailure } from "@/lib/client/api";
import {
  FREE_SPINS,
  GENDERS,
  POPULAR_CITIES,
  SPIN_PACKS,
} from "@/lib/constants";
import type { CircleStats } from "@/lib/stats";

type Quota = {
  freeRemaining: number;
  paidRemaining: number;
  totalRemaining: number;
  canPickGender: boolean;
  needsPack: boolean;
};

const SCAN_CITIES = POPULAR_CITIES.slice(0, 10);

export function SpinScreen({
  initialQuota,
  pendingInvites,
  myStyles,
  stats,
}: {
  initialQuota: Quota;
  pendingInvites: number;
  /** Used to highlight what the viewer shares with whoever the reel lands on. */
  myStyles: string[];
  stats: CircleStats;
}) {
  const router = useRouter();
  const toast = useToast();

  const [quota, setQuota] = useState<Quota>(initialQuota);
  const [spinning, setSpinning] = useState(false);
  const [partner, setPartner] = useState<PublicProfile | null>(null);
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "sent">("idle");
  const [showPacks, setShowPacks] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  /**
   * Nothing about filters or prices exists until the free run is spent. A
   * first-time dancer should meet the reel, not a price list.
   */
  const onFreeRun = quota.freeRemaining > 0;
  const hasPaidSpins = quota.paidRemaining > 0;
  const outOfSpins = quota.totalRemaining === 0;

  const refreshQuota = useCallback(async () => {
    try {
      const res = await api.get<{ quota: Quota }>("/api/me");
      setQuota(res.quota);
    } catch {
      /* the next spin surfaces any problem */
    }
  }, []);

  const spin = async () => {
    if (spinning) return;
    if (quota.totalRemaining <= 0) {
      setShowPacks(true);
      return;
    }

    setSpinning(true);
    setPartner(null);
    setInviteState("idle");

    const startedAt = Date.now();
    const settle = (run: () => void) => {
      const wait = Math.max(0, TOTAL_SPIN_MS - (Date.now() - startedAt));
      settleTimer.current = setTimeout(run, wait);
    };

    try {
      const res = await api.post<{ partner: PublicProfile; quota: Quota }>(
        "/api/search/spin",
        // City travels on every pull; gender only once it is unlocked.
        { gender: hasPaidSpins ? gender : null, city: city.trim() || null },
      );
      // Never cut the reel short, however fast the API answered.
      settle(() => {
        setPartner(res.partner);
        setQuota(res.quota);
        setSpinning(false);
      });
    } catch (error) {
      settle(() => {
        setSpinning(false);
        if (error instanceof ApiFailure && error.status === 402) {
          setShowPacks(true);
          return;
        }
        toast.show(
          error instanceof Error ? error.message : "Could not spin.",
          error instanceof ApiFailure && error.status === 404 ? "warn" : "error",
        );
      });
    }
  };

  const invite = async () => {
    if (!partner) return;
    setInviteState("sending");
    try {
      const res = await api.post<{ matchId: string }>("/api/interest", {
        toUserId: partner.id,
      });
      // Straight into the conversation — there is nothing to wait for.
      router.push(`/chat/${res.matchId}`);
    } catch (error) {
      setInviteState("idle");
      toast.show(error instanceof Error ? error.message : "Could not send.", "error");
    }
  };

  return (
    <main className="app-shell min-h-dvh pt-safe pb-32">
      <header className="flex items-end justify-between py-4">
        <div>
          <h1 className="gold-text font-display text-[25px] font-extrabold leading-none">
            Garba Circle
          </h1>
          <p className="mt-1.5 text-[13px] text-cream/55">
            {onFreeRun
              ? `${quota.freeRemaining} free ${quota.freeRemaining === 1 ? "spin" : "spins"} left`
              : hasPaidSpins
                ? `${quota.paidRemaining} ${quota.paidRemaining === 1 ? "spin" : "spins"} left`
                : "Out of spins"}
          </p>
        </div>

        {/* Free spins as diya that go out as they are spent. */}
        {onFreeRun ? (
          <div className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-night/60 px-3 py-2">
            {Array.from({ length: FREE_SPINS }).map((_, i) => (
              <span
                key={i}
                className="block h-2.5 w-2.5 rounded-full transition-all duration-500"
                style={
                  i < quota.freeRemaining
                    ? { background: "#ffb627", boxShadow: "0 0 9px #ffb627" }
                    : { background: "rgba(255,244,224,0.16)" }
                }
              />
            ))}
          </div>
        ) : hasPaidSpins ? (
          <div className="flex items-center gap-1.5 rounded-full border border-peacock/40 bg-peacock/10 px-3.5 py-2">
            <span className="font-display text-[15px] font-extrabold text-peacock">
              {quota.paidRemaining}
            </span>
            <span className="text-[11.5px] font-semibold text-peacock/75">left</span>
          </div>
        ) : null}
      </header>

      <CircleLive initial={stats} />

      <SlotMachine
        spinning={spinning}
        onPull={spin}
        outOfSpins={outOfSpins}
        scanningCities={city.trim() ? [city.trim()] : SCAN_CITIES}
        idleHint={
          outOfSpins
            ? "Tap for more spins"
            : partner
              ? "Spin again for someone new"
              : "Tap SPIN to find your partner"
        }
      />

      {/* Choosing a city is free on every pull. Gender is what a pack buys. */}
      <section className="panel mt-4 p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-[14.5px] font-bold tracking-wide">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-marigold" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
            Where are you dancing?
          </h2>
          {city.trim() && (
            <button
              onClick={() => setCity("")}
              className="text-[12.5px] font-semibold text-cream/50"
            >
              Any city
            </button>
          )}
        </div>

        <input
          className="field focus:field-focus"
          list="spin-cities"
          placeholder="Any city in India"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <datalist id="spin-cities">
          {POPULAR_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        {hasPaidSpins && (
          <div className="mt-4 border-t border-white/10 pt-3.5">
            <h3 className="mb-2.5 flex items-center gap-2 font-display text-[14.5px] font-bold tracking-wide">
              <span className="text-marigold">&#10038;</span>
              Who you meet
            </h3>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGender(gender === g.key ? null : g.key)}
                  className={`chip flex-1 justify-center ${gender === g.key ? "chip-on" : ""}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {partner && !spinning && (
        <section
          className="mt-4"
          style={{ animation: "spotlight-in 520ms cubic-bezier(.2,.9,.3,1) both" }}
        >
          <ProfileCard
            profile={partner}
            myStyles={myStyles}
            footer={
              <div className="flex gap-2.5">
                <button onClick={spin} className="btn-ghost w-auto flex-1" disabled={spinning}>
                  Next
                </button>
                <button
                  onClick={invite}
                  disabled={inviteState !== "idle"}
                  className="btn-primary active:btn-primary-active flex-[1.6] disabled:opacity-60"
                >
                  {inviteState === "sending"
                    ? "Opening chat…"
                    : "Send dandiya & chat"}
                </button>
              </div>
            }
          />
          <p className="mt-2.5 text-center text-[12.5px] leading-snug text-cream/45">
            Sending a dandiya opens the chat right away {"\u2014"} no waiting for
            them to accept.
          </p>
        </section>
      )}

      {/* The one moment filters and prices are introduced: after the free run. */}
      {outOfSpins && !spinning && (
        <section
          className="panel mt-4 overflow-hidden"
          style={{ animation: "spotlight-in 520ms cubic-bezier(.2,.9,.3,1) both" }}
        >
          <div className="flex h-1.5 w-full">
            <span className="flex-1 bg-marigold" />
            <span className="flex-1 bg-rani" />
            <span className="flex-1 bg-peacock" />
          </div>
          <div className="p-5">
            <h2 className="font-display text-[20px] font-extrabold leading-tight">
              That&rsquo;s your {FREE_SPINS} free spins
            </h2>
            <p className="mt-1.5 text-[14.5px] leading-snug text-cream/70">
              Keep going, and this time you decide who the reel lands on.
            </p>
            <div className="mt-4 space-y-2.5">
              {[
                ["♀♂", "Choose who you meet", "Search only women, only men, or everyone"],
                ["\u{1F4CD}", "Your city stays free", "Picking a city never costs anything"],
              ].map(([icon, title, body]) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-marigold/25 to-rani/15 text-[13px]">
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[14.5px] font-bold leading-tight">{title}</p>
                    <p className="text-[12.5px] leading-snug text-cream/55">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowPacks(true)}
              className="btn-primary active:btn-primary-active mt-5"
            >
              Unlock more spins
            </button>
          </div>
        </section>
      )}

      {!partner && !spinning && onFreeRun && (
        <p className="mt-6 text-center text-[13.5px] leading-relaxed text-cream/45">
          Every pull lands on a real dancer.
          <br />
          Nau raat, and the circle is already turning.
        </p>
      )}

      <PackSheet
        open={showPacks}
        title="Keep the reel spinning"
        subtitle="Every paid spin also lets you choose who the reel lands on."
        packs={SPIN_PACKS}
        onClose={() => setShowPacks(false)}
        onPurchased={() => {
          setShowPacks(false);
          refreshQuota();
        }}
      />

      <BottomNav badge={pendingInvites} />
      <FirstRunGuide />
    </main>
  );
}
