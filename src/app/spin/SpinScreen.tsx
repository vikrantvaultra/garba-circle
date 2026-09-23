"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Wheel, type WheelHandle, type WheelPhase } from "@/components/circle/Wheel";
import { MatchSheet } from "@/components/circle/MatchSheet";
import { PetalBurst, type PetalBurstHandle } from "@/components/circle/PetalBurst";
import { dancerColor, initials } from "@/components/circle/dancer";
import { PackSheet } from "@/components/PackSheet";
import { BottomNav } from "@/components/BottomNav";
import { CircleLive } from "@/components/CircleLive";
import { FirstRunGuide } from "@/components/FirstRunGuide";
import { useToast } from "@/components/Toast";
import { api, ApiFailure } from "@/lib/client/api";
import { buzz, sound } from "@/lib/client/sound";
import { compatibility, type Landing } from "@/lib/compat";
import type { PublicProfile } from "@/lib/api";
import { FREE_SPINS, POPULAR_CITIES, SPIN_PACKS } from "@/lib/constants";
import type { CircleStats } from "@/lib/stats";
import type { Tonight } from "@/lib/search/tonight";
import styles from "./spin.module.css";

type Quota = {
  freeRemaining: number;
  paidRemaining: number;
  totalRemaining: number;
  canPickGender: boolean;
  needsPack: boolean;
};

type Me = {
  city: string | null;
  danceStyles: string[];
  skillLevel: string | null;
  age: number | null;
};

const CHIP_CITIES = ["Mumbai", "Ahmedabad", "Vadodara", "Surat", "Pune"];

const WHO = [
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
  { value: "other", label: "Other" },
  { value: "", label: "Everyone" },
];

/** What the quota will be once the server has taken this spin: free ones go first. */
function afterOneSpin(q: Quota): Quota {
  const free = q.freeRemaining > 0 ? q.freeRemaining - 1 : 0;
  const paid = q.freeRemaining > 0 ? q.paidRemaining : Math.max(0, q.paidRemaining - 1);
  return {
    freeRemaining: free,
    paidRemaining: paid,
    totalRemaining: free + paid,
    canPickGender: paid > 0,
    needsPack: free === 0 && paid === 0,
  };
}

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SpinScreen({
  initialQuota,
  pendingInvites,
  me,
  stats,
  tonight,
  subtitle,
}: {
  initialQuota: Quota;
  pendingInvites: number;
  /** The viewer's own choices, used to score whoever the circle lands on. */
  me: Me;
  stats: CircleStats;
  tonight: Tonight;
  subtitle: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [quota, setQuota] = useState<Quota>(initialQuota);
  const [phase, setPhase] = useState<{ phase: WheelPhase; power: number }>({
    phase: "idle",
    power: 0,
  });
  const [sheet, setSheet] = useState<"none" | "match" | "packs">("none");
  const [landing, setLanding] = useState<Landing | null>(null);
  const [haul, setHaul] = useState<Landing[]>(tonight.landings);
  const [inviting, setInviting] = useState(false);
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");

  const soundOn = useSyncExternalStore(sound.subscribe, () => sound.enabled, () => true);

  const wheelRef = useRef<WheelHandle>(null);
  const burstRef = useRef<PetalBurstHandle>(null);
  const resultRef = useRef<Landing | null>(null);
  const failureRef = useRef<unknown>(null);

  const onFreeRun = quota.freeRemaining > 0;
  const outOfSpins = quota.totalRemaining === 0;
  // Gender is what a pack buys; the server only honours it on a paid pull.
  const canPickGender = quota.freeRemaining === 0 && quota.paidRemaining > 0;

  const refreshQuota = async () => {
    try {
      const res = await api.get<{ quota: Quota }>("/api/me");
      setQuota(res.quota);
    } catch {
      /* the next spin surfaces any problem */
    }
  };

  const onSpin = async (): Promise<boolean> => {
    const before = quota;
    const useGender = before.freeRemaining === 0 && before.paidRemaining > 0;
    setQuota(afterOneSpin(before));
    resultRef.current = null;
    failureRef.current = null;
    try {
      const res = await api.post<{ partner: PublicProfile; quota: Quota }>(
        "/api/search/spin",
        // City travels on every pull; gender only once it is unlocked.
        { gender: useGender && gender ? gender : null, city: city.trim() || null },
      );
      setQuota(res.quota);
      resultRef.current = { ...compatibility(me, res.partner), profile: res.partner };
      return true;
    } catch (error) {
      // Nothing is charged when the server says no, so put the count back.
      setQuota(before);
      failureRef.current = error;
      return false;
    }
  };

  const onSettled = (won: boolean, rect: DOMRect) => {
    const result = resultRef.current;
    if (!won || !result) {
      const error = failureRef.current;
      if (error instanceof ApiFailure && error.status === 402) {
        setSheet("packs");
      } else if (error) {
        toast.show(
          error instanceof Error ? error.message : "Could not spin.",
          error instanceof ApiFailure && error.status === 404 ? "warn" : "error",
        );
      }
      return;
    }

    buzz(result.tier === "soulmate" ? [40, 50, 40, 50, 90] : [30, 40, 30], false);
    burstRef.current?.burst(
      rect.left + rect.width / 2,
      rect.top + 14,
      result.tier === "soulmate" ? 140 : result.tier === "rare" ? 80 : 45,
      result.tier,
    );
    setHaul((prev) => [result, ...prev.filter((h) => h.profile.id !== result.profile.id)]);
    setLanding(result);
    const wait = reducedMotion() ? 0 : result.tier === "soulmate" ? 900 : 600;
    setTimeout(() => setSheet("match"), wait);
  };

  const closeMatch = () => {
    setSheet("none");
    wheelRef.current?.reset();
  };

  const spinAgain = () => {
    closeMatch();
    if (outOfSpins) {
      setTimeout(() => setSheet("packs"), 250);
      return;
    }
    setTimeout(() => wheelRef.current?.spin(0.3), 350);
  };

  const invite = async () => {
    if (!landing) return;
    setInviting(true);
    try {
      const res = await api.post<{ matchId: string }>("/api/interest", {
        toUserId: landing.profile.id,
      });
      // Straight into the conversation — there is nothing to wait for.
      router.push(`/chat/${res.matchId}`);
    } catch (error) {
      setInviting(false);
      toast.show(error instanceof Error ? error.message : "Could not send.", "error");
    }
  };

  const share = async () => {
    const data = {
      title: "Garba Circle",
      text: "Find your dandiya partner this Navratri on Garba Circle.",
      url: window.location.origin,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard?.writeText(data.url);
        toast.show("Link copied", "success");
      }
    } catch {
      /* they closed the share sheet */
    }
  };

  let hint: ReactNode;
  if (phase.phase === "charging") {
    hint = (
      <>
        <strong>Keep holding…</strong> release to spin
      </>
    );
  } else if (phase.phase === "spinning") {
    hint = phase.power > 0.8 ? "Full power spin!" : "Finding your partner in the circle…";
  } else if (outOfSpins) {
    hint = "You're out of spins. Tap the garbo for more.";
  } else if (quota.totalRemaining === 1) {
    hint = (
      <>
        <strong>{onFreeRun ? "Last free spin." : "Last spin in your pack."}</strong> Make it
        a big one.
      </>
    );
  } else {
    hint = (
      <>
        Tap, or <strong>hold for a bigger spin</strong>
      </>
    );
  }

  const lit = Math.min(quota.totalRemaining, FREE_SPINS);
  const spinsPill = (
    <>
      <span className={styles.diyas} aria-hidden>
        {Array.from({ length: FREE_SPINS }, (_, i) => (
          <i key={i} data-used={i >= lit} />
        ))}
      </span>
      <span>
        <b>{quota.totalRemaining}</b> {quota.totalRemaining === 1 ? "spin" : "spins"} left
      </span>
    </>
  );
  const low = quota.totalRemaining > 0 && quota.totalRemaining <= 2;

  const special = haul.filter((h) => h.tier !== "jodi").length;
  const streak = tonight.pastStreak + (haul.length > 0 ? 1 : 0);
  const streakText = streak >= 2 ? `${streak}-night streak.` : "";
  const haulText =
    haul.length === 0
      ? `Spin to start tonight's collection.${streakText ? ` You're on a ${streakText}` : ""}`
      : `${haul.length} ${haul.length === 1 ? "jodi" : "jodis"} tonight${
          special ? `, ${special} rare` : ""
        }.${streakText ? ` ${streakText}` : ""}`;

  const typedCity = city.trim().toLowerCase();

  return (
    <main className="app-shell min-h-dvh pb-[calc(env(safe-area-inset-bottom,0px)+120px)] pt-[calc(env(safe-area-inset-top,0px)+28px)]">
      <header className={styles.top}>
        <div className={styles.brand}>
          <p className={styles.gu} lang="gu" aria-hidden>
            ગરબા
          </p>
          <h1>Garba Circle</h1>
          <p className={styles.sub}>{subtitle}</p>
        </div>
        <div className={styles.hud}>
          {/* Prices stay out of sight until the free run is over. */}
          {onFreeRun ? (
            <div className={styles.spins} data-low={low} role="status">
              {spinsPill}
            </div>
          ) : (
            <button
              type="button"
              className={styles.spins}
              data-low={low}
              onClick={() => setSheet("packs")}
              aria-label={`${quota.totalRemaining} ${quota.totalRemaining === 1 ? "spin" : "spins"} left. Get more spins`}
            >
              {spinsPill}
            </button>
          )}
          <button
            type="button"
            className={styles.iconBtn}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Sound on" : "Sound off"}
            onClick={() => {
              sound.unlock();
              sound.setEnabled(!soundOn);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              <path
                d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
                style={{ opacity: soundOn ? 1 : 0.2 }}
              />
            </svg>
          </button>
        </div>
      </header>

      <CircleLive initial={stats} />

      <section className={styles.stage} aria-label="Spin the circle">
        <Wheel
          ref={wheelRef}
          empty={outOfSpins}
          label={outOfSpins ? "Get spins" : "Spin"}
          ariaLabel={outOfSpins ? "Get more spins" : "Spin the circle. Hold for a bigger spin"}
          describedBy="spin-hint"
          onSpin={onSpin}
          onSettled={onSettled}
          onEmptyTap={() => setSheet("packs")}
          onPhase={(p, power) => setPhase({ phase: p, power })}
        />
        <p className={styles.hint} id="spin-hint" aria-live="polite">
          {hint}
        </p>
      </section>

      <section className={styles.haul} aria-label="Tonight's jodis">
        <div className="min-w-0">
          <h2>Tonight&rsquo;s jodis</h2>
          <p>{haulText}</p>
        </div>
        {haul.length > 0 && (
          <div className={styles.stack}>
            {haul
              .slice(0, 5)
              .reverse()
              .map((h) => (
                <button
                  key={h.profile.id}
                  type="button"
                  data-tier={h.tier}
                  style={{ background: dancerColor(h.profile.id) }}
                  aria-label={`See ${h.profile.name ?? "this dancer"} again`}
                  onClick={() => {
                    setLanding(h);
                    setSheet("match");
                  }}
                >
                  {h.profile.avatarUrl ? (
                    <img src={h.profile.avatarUrl} alt="" />
                  ) : (
                    initials(h.profile.name)
                  )}
                </button>
              ))}
          </div>
        )}
      </section>

      {/* Choosing a city is free on every pull. Gender is what a pack buys. */}
      <section className={styles.prefs} aria-label="Your preferences">
        <label className={styles.q} htmlFor="spin-city">
          Where are you dancing?
        </label>
        <input
          id="spin-city"
          className="field focus:field-focus"
          type="text"
          list="spin-cities"
          placeholder="Any city in India"
          autoComplete="address-level2"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <datalist id="spin-cities">
          {POPULAR_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Popular cities">
          {CHIP_CITIES.map((c) => {
            const on = typedCity === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                className={`chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream ${on ? "chip-on" : ""}`}
                onClick={() => setCity(on ? "" : c)}
              >
                {c}
              </button>
            );
          })}
        </div>

        {canPickGender && (
          <fieldset className={styles.seg}>
            <legend className={styles.q}>Who you&rsquo;d like to meet</legend>
            <div className={styles.segTrack}>
              {WHO.map((w) => (
                <label key={w.value || "all"}>
                  <input
                    type="radio"
                    name="meet"
                    value={w.value}
                    checked={gender === w.value}
                    onChange={() => setGender(w.value)}
                  />
                  <span>{w.label}</span>
                </label>
              ))}
            </div>
            <p className={styles.segNote}>Included with every paid spin.</p>
          </fieldset>
        )}
      </section>

      <MatchSheet
        open={sheet === "match"}
        landing={landing}
        againNote={outOfSpins ? "Get more spins" : `${quota.totalRemaining} left`}
        inviting={inviting}
        onAgain={spinAgain}
        onInvite={invite}
        onClose={closeMatch}
      />

      <PackSheet
        open={sheet === "packs"}
        title={outOfSpins ? "Keep dancing tonight" : "Top up your spins"}
        subtitle={
          outOfSpins
            ? `You've used your ${FREE_SPINS} free spins. ${stats.dancers} ${stats.dancers === 1 ? "dancer is" : "dancers are"} in the circle.`
            : `You have ${quota.totalRemaining} ${quota.totalRemaining === 1 ? "spin" : "spins"} left. Top up any time.`
        }
        packs={SPIN_PACKS}
        teaser={
          <p className="m-0">
            <b className="text-[#FF9FCF]">Choose who you meet.</b> Every paid spin lets
            you pick women, men or everyone. Your city always stays free.
          </p>
        }
        footer={
          <button type="button" className="btn-ghost h-auto py-3 text-left" onClick={share}>
            <span className="w-full">
              Invite your garba group
              <small className="mt-0.5 block text-[12px] font-medium opacity-80">
                Send them the link to Garba Circle
              </small>
            </span>
          </button>
        }
        onClose={() => setSheet("none")}
        onPurchased={() => {
          setSheet("none");
          void refreshQuota();
          const rect = document.getElementById("spin-hint")?.getBoundingClientRect();
          if (rect) burstRef.current?.burst(rect.left + rect.width / 2, rect.top - 160, 60, "rare");
          sound.chime("rare");
        }}
      />

      <PetalBurst ref={burstRef} />
      <BottomNav badge={pendingInvites} />
      <FirstRunGuide />
    </main>
  );
}
