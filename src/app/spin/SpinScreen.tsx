"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Wheel, type WheelHandle, type WheelPhase } from "@/components/circle/Wheel";
import { MatchSheet } from "@/components/circle/MatchSheet";
import { PetalBurst, type PetalBurstHandle } from "@/components/circle/PetalBurst";
import { dancerColor, initials } from "@/components/circle/dancer";
import { CityPicker, type GenderChoice } from "@/components/circle/CityPicker";
import { PackSheet } from "@/components/PackSheet";
import { BottomNav } from "@/components/BottomNav";
import { CircleLive } from "@/components/CircleLive";
import { FirstRunGuide } from "@/components/FirstRunGuide";
import { useToast } from "@/components/Toast";
import { api, ApiFailure } from "@/lib/client/api";
import { buzz, sound } from "@/lib/client/sound";
import * as spinPrefs from "@/lib/client/spin-prefs";
import { compatibility, type Landing } from "@/lib/compat";
import type { PublicProfile } from "@/lib/api";
import { FREE_SPINS, UNLIMITED_PASS_ENDS_LABEL, type Pack } from "@/lib/constants";
import type { CircleStats } from "@/lib/stats";
import type { Tonight } from "@/lib/search/tonight";
import type { CityOption } from "@/lib/search/cities";
import styles from "./spin.module.css";

type Quota = {
  freeRemaining: number;
  paidRemaining: number;
  totalRemaining: number;
  /** An unlimited pass is active: nothing counts down. */
  unlimited: boolean;
  unlimitedUntil: string | null;
  needsPack: boolean;
};

type Me = {
  city: string | null;
  danceStyles: string[];
  skillLevel: string | null;
  age: number | null;
};

function dancerCount(option: CityOption, gender: GenderChoice | null): number {
  return gender === "female" ? option.female : gender === "male" ? option.male : option.total;
}

function dancerLabel(n: number, gender: GenderChoice | null): string {
  if (n === 0) return "No one yet";
  const noun =
    gender === "female"
      ? n === 1 ? "woman" : "women"
      : gender === "male"
        ? n === 1 ? "man" : "men"
        : n === 1 ? "dancer" : "dancers";
  return `${n} ${noun}`;
}

const WHO: { value: GenderChoice; label: string }[] = [
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
  { value: "both", label: "Both" },
];

/** What the quota will be once the server has taken this spin: free ones go first. */
function afterOneSpin(q: Quota): Quota {
  if (q.unlimited) return q;
  const free = q.freeRemaining > 0 ? q.freeRemaining - 1 : 0;
  const paid = q.freeRemaining > 0 ? q.paidRemaining : Math.max(0, q.paidRemaining - 1);
  return {
    freeRemaining: free,
    paidRemaining: paid,
    totalRemaining: free + paid,
    unlimited: false,
    unlimitedUntil: null,
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
  cities,
  packs,
  subtitle,
}: {
  initialQuota: Quota;
  pendingInvites: number;
  /** The viewer's own choices, used to score whoever the circle lands on. */
  me: Me;
  stats: CircleStats;
  tonight: Tonight;
  cities: CityOption[];
  /** Packs on sale right now (the unlimited pass ends with Navratri). */
  packs: Pack[];
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
  // Both must be chosen before the circle will spin, free spins included.
  // Kept for the browser session so "Spin again" from a chat keeps them.
  const prefsRaw = useSyncExternalStore(
    spinPrefs.subscribe,
    spinPrefs.getSnapshot,
    spinPrefs.getServerSnapshot,
  );
  const prefs = useMemo(() => spinPrefs.parse(prefsRaw), [prefsRaw]);
  // A remembered city nobody dances in any more is dropped, not kept.
  const city =
    prefs.city && cities.some((c) => c.name.toLowerCase() === prefs.city!.toLowerCase())
      ? prefs.city
      : null;
  const gender = prefs.gender;
  // Counts follow the gender chosen, so "3 women" means three women.
  const pickerCities = useMemo(
    () =>
      cities.map((c) => {
        const n = dancerCount(c, gender);
        return { name: c.name, count: n, countLabel: dancerLabel(n, gender) };
      }),
    [cities, gender],
  );
  const setCity = (next: string | null) => spinPrefs.save({ ...prefs, city: next });
  const setGender = (next: GenderChoice) => spinPrefs.save({ ...prefs, gender: next });
  const [attention, setAttention] = useState<"city" | "gender" | null>(null);

  const soundOn = useSyncExternalStore(sound.subscribe, () => sound.enabled, () => true);

  const wheelRef = useRef<WheelHandle>(null);
  const burstRef = useRef<PetalBurstHandle>(null);
  const resultRef = useRef<Landing | null>(null);
  const failureRef = useRef<unknown>(null);

  const unlimited = quota.unlimited;
  const onFreeRun = !unlimited && quota.freeRemaining > 0;
  const outOfSpins = quota.needsPack;
  // No point offering the pass to someone who has it.
  const packsForSale = unlimited ? packs.filter((p) => !p.unlimited) : packs;
  const ready = Boolean(city && gender);

  useEffect(() => {
    if (!attention) return;
    const timer = setTimeout(() => setAttention(null), 1900);
    return () => clearTimeout(timer);
  }, [attention]);

  /** A tap on the garbo before both are chosen points at whatever is missing. */
  const askForFilters = () => {
    const missing = city ? "gender" : "city";
    setAttention(missing);
    buzz([20, 40, 20], false);
    if (missing === "city") {
      document.getElementById("spin-city")?.focus();
    } else {
      const first = document.querySelector<HTMLInputElement>('input[name="meet"]');
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus({ preventScroll: true });
    }
  };

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
    setQuota(afterOneSpin(before));
    resultRef.current = null;
    failureRef.current = null;
    try {
      const res = await api.post<{ partner: PublicProfile; quota: Quota }>(
        "/api/search/spin",
        { gender, city },
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
  } else if (!ready) {
    hint = (
      <>
        Choose <strong>{city ? "who you'd like to meet" : gender ? "a city" : "a city and who you'd like to meet"}</strong>, then spin
      </>
    );
  } else if (unlimited) {
    hint = (
      <>
        Unlimited spins till {UNLIMITED_PASS_ENDS_LABEL}. <strong>Hold for a bigger spin</strong>
      </>
    );
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

  const lit = unlimited ? FREE_SPINS : Math.min(quota.totalRemaining, FREE_SPINS);
  const spinsPill = (
    <>
      <span className={styles.diyas} aria-hidden>
        {Array.from({ length: FREE_SPINS }, (_, i) => (
          <i key={i} data-used={i >= lit} />
        ))}
      </span>
      {unlimited ? (
        <span>
          <b>∞</b> unlimited
        </span>
      ) : (
        <span>
          <b>{quota.totalRemaining}</b> {quota.totalRemaining === 1 ? "spin" : "spins"} left
        </span>
      )}
    </>
  );
  const low = !unlimited && quota.totalRemaining > 0 && quota.totalRemaining <= 2;
  const spinsLabel = unlimited
    ? `Unlimited spins till ${UNLIMITED_PASS_ENDS_LABEL}`
    : `${quota.totalRemaining} ${quota.totalRemaining === 1 ? "spin" : "spins"} left`;

  const special = haul.filter((h) => h.tier !== "jodi").length;
  const streak = tonight.pastStreak + (haul.length > 0 ? 1 : 0);
  const streakText = streak >= 2 ? `${streak}-night streak.` : "";
  const haulText =
    haul.length === 0
      ? `Spin to start tonight's collection.${streakText ? ` You're on a ${streakText}` : ""}`
      : `${haul.length} ${haul.length === 1 ? "jodi" : "jodis"} tonight${
          special ? `, ${special} rare` : ""
        }.${streakText ? ` ${streakText}` : ""}`;

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
          {onFreeRun || unlimited ? (
            <div className={styles.spins} data-low={low} role="status">
              {spinsPill}
            </div>
          ) : (
            <button
              type="button"
              className={styles.spins}
              data-low={low}
              onClick={() => setSheet("packs")}
              aria-label={`${spinsLabel}. Get more spins`}
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

      {/* Where and who, chosen before every spin. Both are free. */}
      <section className={styles.prefs} aria-label="Who you're looking for">
        <label className={styles.q} htmlFor="spin-city">
          Where are you dancing?
        </label>
        <CityPicker
          id="spin-city"
          options={pickerCities}
          value={city}
          myCity={me.city}
          attention={attention === "city"}
          onChange={setCity}
        />

        <fieldset className={styles.seg} data-attention={attention === "gender"}>
          <legend className={styles.q}>Who you&rsquo;d like to meet</legend>
          <div className={styles.segTrack}>
            {WHO.map((w) => (
              <label key={w.value}>
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
        </fieldset>
      </section>

      <section className={styles.stage} aria-label="Spin the circle">
        <Wheel
          ref={wheelRef}
          empty={outOfSpins}
          blocked={!ready}
          label={outOfSpins ? "Get spins" : "Spin"}
          ariaLabel={
            outOfSpins
              ? "Get more spins"
              : ready
                ? "Spin the circle. Hold for a bigger spin"
                : "Spin the circle. Choose a city and who you'd like to meet first"
          }
          describedBy="spin-hint"
          onSpin={onSpin}
          onSettled={onSettled}
          onEmptyTap={() => setSheet("packs")}
          onBlockedTap={askForFilters}
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


      <MatchSheet
        open={sheet === "match"}
        landing={landing}
        againNote={
          unlimited ? "Unlimited" : outOfSpins ? "Get more spins" : `${quota.totalRemaining} left`
        }
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
            : unlimited
              ? `You have unlimited spins till ${UNLIMITED_PASS_ENDS_LABEL}.`
              : `You have ${quota.totalRemaining} ${quota.totalRemaining === 1 ? "spin" : "spins"} left. Top up any time.`
        }
        packs={packsForSale}
        teaser={
          <p className="m-0">
            <b className="text-[#FF9FCF]">Same choices, more spins.</b> Pick any city
            and who you&rsquo;d like to meet on every spin, free or paid.
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
