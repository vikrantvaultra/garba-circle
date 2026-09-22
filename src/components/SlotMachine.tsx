"use client";

import { useEffect, useRef } from "react";
import { REEL_SYMBOLS, ReelDefs } from "./ReelIcons";
import { SpinButton, type SpinButtonState } from "./SpinButton";

const ITEM_H = 104;
const REPEATS = 22;
const CYCLE = REEL_SYMBOLS.length * ITEM_H;

/** Fast phase per reel, then a staggered decelerating landing. */
const SPIN_UP_MS = 900;
const LAND_STAGGER_MS = 330;
const LAND_MS = 950;
export const TOTAL_SPIN_MS = SPIN_UP_MS + LAND_STAGGER_MS * 2 + LAND_MS;

const STRIP = Array.from({ length: REPEATS }, (_, r) =>
  REEL_SYMBOLS.map((Symbol, i) => ({ Symbol, key: `${r}-${i}` })),
).flat();

function currentTranslateY(el: HTMLElement): number {
  const { transform } = getComputedStyle(el);
  if (!transform || transform === "none") return 0;
  // matrix(a, b, c, d, tx, ty) — ty is the sixth value.
  const values = transform.match(/matrix.*\((.+)\)/)?.[1].split(", ");
  return values ? parseFloat(values[values.length - 1]) : 0;
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported, and entirely optional */
  }
}

export function SlotMachine({
  spinning,
  onPull,
  outOfSpins = false,
  scanningCities = [],
  idleHint,
}: {
  spinning: boolean;
  onPull: () => void;
  /** Turns the control into a "get more" state instead of disabling it. */
  outOfSpins?: boolean;
  /** Cycled under the reels while spinning, so the search feels like a search. */
  scanningCities?: string[];
  idleHint?: string;
}) {
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cabinetRef = useRef<HTMLDivElement | null>(null);
  const leverRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The scanning line is written straight to the DOM rather than held in
  // state: it changes three times a second and none of it should cost React a
  // render while the reels are mid-flight.
  const scanRef = useRef<HTMLSpanElement | null>(null);

  const buttonState: SpinButtonState = spinning
    ? "spinning"
    : outOfSpins
      ? "empty"
      : "ready";

  useEffect(() => {
    if (!spinning) return;

    buzz(14);

    const cabinet = cabinetRef.current;
    if (cabinet) {
      cabinet.style.animation = "machine-shake 420ms ease-in-out";
      setTimeout(() => {
        if (cabinet) cabinet.style.animation = "";
      }, 440);
    }

    const lever = leverRef.current;
    if (lever) {
      lever.dataset.pulled = "true";
      setTimeout(() => {
        if (lever) lever.dataset.pulled = "false";
      }, 460);
    }

    // Phase one: loop fast and blurred. Because the strip repeats every cycle,
    // restarting the keyframe at zero is invisible.
    reelRefs.current.forEach((reel, i) => {
      if (!reel) return;
      reel.style.transition = "none";
      reel.style.animation = `reel-spin ${150 + i * 22}ms linear infinite`;
      reel.style.filter = "blur(5px)";
    });

    // Phase two: hand off to a decelerating transition, one reel at a time.
    timers.current = reelRefs.current.map((reel, i) =>
      setTimeout(() => {
        if (!reel) return;
        const from = currentTranslateY(reel);
        reel.style.animation = "none";
        reel.style.transform = `translateY(${from}px)`;
        void reel.offsetHeight; // commit the position before transitioning

        const target =
          from -
          CYCLE * 2 -
          Math.floor(Math.random() * REEL_SYMBOLS.length) * ITEM_H;

        reel.style.transition = `transform ${LAND_MS}ms cubic-bezier(0.16, 0.86, 0.24, 1), filter 420ms ease-out`;
        reel.style.filter = "blur(0px)";
        reel.style.transform = `translateY(${target}px)`;

        // Flash the window as it locks, and keep the strip from running out by
        // folding whole cycles back off once it has settled.
        setTimeout(() => {
          buzz(i === 2 ? [18, 40, 26] : 10);
          reel.parentElement
            ?.querySelector<HTMLElement>("[data-flash]")
            ?.animate(
              [{ opacity: 0 }, { opacity: 0.85 }, { opacity: 0 }],
              { duration: 420, easing: "ease-out" },
            );
          reel.style.transition = "none";
          reel.style.transform = `translateY(${target % CYCLE}px)`;
        }, LAND_MS);
      }, SPIN_UP_MS + i * LAND_STAGGER_MS),
    );

    if (scanningCities.length > 0) {
      let index = -1;
      const ticker = setInterval(() => {
        index = (index + 1) % scanningCities.length;
        if (scanRef.current) {
          scanRef.current.textContent = `Scanning ${scanningCities[index]}…`;
        }
      }, 360);
      timers.current.push(ticker as unknown as ReturnType<typeof setTimeout>);
    }

    const snapshot = timers.current;
    return () => snapshot.forEach(clearTimeout);
  }, [spinning, scanningCities]);

  return (
    <div className="relative">
      <ReelDefs />

      {/* Cabinet glow. Breathes when idle, burns steady while spinning. */}
      <div
        className="pointer-events-none absolute -inset-3 rounded-[46px] bg-[radial-gradient(60%_58%_at_50%_42%,rgba(255,138,0,0.45),transparent_72%)] blur-2xl"
        style={{ animation: spinning ? "none" : "idle-breathe 3.6s ease-in-out infinite", opacity: spinning ? 0.95 : undefined }}
      />

      <div
        ref={cabinetRef}
        className="relative overflow-hidden rounded-[32px] p-[1.5px]"
        style={{
          background:
            "linear-gradient(160deg, #ffe6a3 0%, #b8862f 22%, #5a3d12 48%, #b8862f 76%, #ffe6a3 100%)",
          boxShadow:
            "0 34px 70px -34px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,214,102,0.22)",
        }}
      >
        <div className="rounded-[30px] bg-gradient-to-b from-[#3a1358] via-[#25093b] to-[#160726] px-4 pb-4 pt-3.5">
          {/* Marquee bulbs */}
          <div className="mb-3.5 flex items-center justify-center gap-[7px]">
            {Array.from({ length: 13 }).map((_, i) => (
              <span
                key={i}
                className="block h-[7px] w-[7px] rounded-full"
                style={{
                  background: i % 2 ? "#ff8a00" : "#ffd982",
                  boxShadow: `0 0 9px ${i % 2 ? "#ff8a00" : "#ffd982"}`,
                  animation: spinning
                    ? `bulb-chase 620ms ease-in-out ${i * 55}ms infinite`
                    : "none",
                  opacity: spinning ? undefined : 0.55,
                }}
              />
            ))}
          </div>

          <div
            className="grid grid-cols-3 gap-2.5"
            style={{ ["--reel-cycle" as string]: `${CYCLE}px` }}
          >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-[18px]"
                  style={{
                    height: ITEM_H,
                    background:
                      "linear-gradient(180deg, #0d0217 0%, #1a0630 55%, #0b0214 100%)",
                    boxShadow:
                      "inset 0 2px 8px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,214,102,0.26)",
                  }}
                >
                  <div
                    ref={(node) => {
                      reelRefs.current[i] = node;
                    }}
                    className="will-change-transform"
                  >
                    {STRIP.map(({ Symbol, key }) => (
                      <div
                        key={key}
                        className="grid place-items-center"
                        style={{ height: ITEM_H }}
                      >
                        <Symbol className="h-[58px] w-[58px] drop-shadow-[0_2px_7px_rgba(255,138,0,0.5)]" />
                      </div>
                    ))}
                  </div>

                  {/* Curved glass: highlight at the top, shadow at the edges. */}
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.20)_0%,rgba(255,255,255,0.02)_34%,rgba(0,0,0,0.30)_100%)]" />
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/55 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/55 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-marigold/35" />
                  <div
                    data-flash
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,#fff3cf,transparent_72%)] opacity-0"
                  />
                </div>
              ))}
          </div>

          {/* Control panel, the way a real cabinet separates reels from the
              button that drives them. */}
          <div className="mt-4 border-t border-gold/20 pt-4">
            <div className="flex justify-center">
              <SpinButton state={buttonState} onClick={onPull} />
            </div>
          </div>

          <p className="mt-4 text-center font-display text-[13px] font-semibold tracking-wide">
            <span
              ref={scanRef}
              className={spinning ? "text-marigold" : "text-cream/55"}
            >
              {spinning
                ? "Dhol baj raha hai…"
                : (idleHint ?? "Pull the dandiya")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
