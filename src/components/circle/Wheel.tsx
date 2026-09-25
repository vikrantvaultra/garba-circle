"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from "react";
import { TICK, buzz, sound } from "@/lib/client/sound";
import styles from "./wheel.module.css";

const DANCERS = 12;
const SLOT_DEG = 360 / DANCERS;
/** The charge meter runs round the middle of the bezel. */
const RADIUS = 142;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** How long a hold takes to reach full power. */
const CHARGE_MS = 1100;
/** Degrees per second the circle drifts at rest. */
const IDLE_SPEED = 7;
/** One full turn at that speed. */
const DRIFT_MS = (360 / IDLE_SPEED) * 1000;
/**
 * How long a throw takes before it lands: at least 4.5 s for a tap, up to
 * 6 s for a full-power hold. The result is never shown sooner, however fast
 * the server answers. Reduced motion gets a short, calm stop instead.
 */
const SPIN_MIN_MS = 4500;
const SPIN_POWER_MS = 1500;
const SPIN_REDUCED_MS = 1000;

const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);
const slotOf = (angle: number) => Math.floor((angle + SLOT_DEG / 2) / SLOT_DEG);

const KICK: Keyframe[] = [
  { transform: "translateX(-50%) rotate(0)" },
  { transform: "translateX(-50%) rotate(-16deg)" },
  { transform: "translateX(-50%) rotate(0)" },
];

export type WheelPhase = "idle" | "charging" | "spinning" | "landed";

export type WheelHandle = {
  /** Throw the circle with a power between 0 and 1, as if released from a hold. */
  spin: (power: number) => void;
  /** Clear the winner's halo and let the circle drift again. */
  reset: () => void;
};

type Props = {
  ref?: Ref<WheelHandle>;
  /** No spins left: the button asks for more instead of spinning. */
  empty: boolean;
  /** Something must be chosen first: a tap asks for it instead of spinning. */
  blocked: boolean;
  label: string;
  ariaLabel: string;
  describedBy?: string;
  /**
   * Called as the circle is thrown. Resolve true once there is someone to
   * land on, false to let the circle stop with nobody picked. The circle
   * never lands before this resolves, however fast the throw.
   */
  onSpin: (power: number) => Promise<boolean>;
  onSettled: (won: boolean, rect: DOMRect) => void;
  onEmptyTap: () => void;
  onBlockedTap: () => void;
  onPhase: (phase: WheelPhase, power: number) => void;
};

type Motion = {
  angle: number;
  last: number;
  idle: boolean;
  lastSlot: number;
  charging: boolean;
  charge: number;
  chargeStart: number;
  /** The pointer path already started a spin, so the click that follows is not a second one. */
  pointerSpin: boolean;
  anim: { from: number; to: number; start: number; dur: number } | null;
  pending: Promise<boolean> | null;
  won: boolean | null;
  winIndex: number;
};

export function Wheel(props: Props) {
  const { ref, empty, blocked, label, ariaLabel, describedBy } = props;

  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const wheelRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const pointerRef = useRef<HTMLImageElement>(null);
  const kickRef = useRef<Animation | null>(null);
  const driftRef = useRef<Animation | null>(null);
  const loop = useRef({ raf: 0, running: false });
  const reduceMotion = useRef(false);

  const m = useRef<Motion>({
    angle: 0,
    last: 0,
    idle: true,
    lastSlot: 0,
    charging: false,
    charge: 0,
    chargeStart: 0,
    pointerSpin: false,
    anim: null,
    pending: null,
    won: null,
    winIndex: 0,
  });

  const setPhase = (phase: WheelPhase) => {
    if (wheelRef.current) wheelRef.current.dataset.phase = phase;
  };

  const clearWin = () => {
    if (ringRef.current) delete ringRef.current.dataset.win;
  };

  const paintRing = () => {
    if (ringRef.current) ringRef.current.style.transform = `rotate(${m.current.angle}deg)`;
  };

  /**
   * The slow drift at rest runs as a Web Animation, which the compositor
   * plays by itself. Writing the angle from script every frame instead kept
   * the main thread restyling and repainting 60 times a second for as long
   * as the circle was on screen.
   */
  const startDrift = () => {
    const ring = ringRef.current;
    const s = m.current;
    if (!ring || reduceMotion.current || driftRef.current) return;
    if (!s.idle || s.anim || s.charging) return;
    driftRef.current = ring.animate(
      [{ transform: `rotate(${s.angle}deg)` }, { transform: `rotate(${s.angle + 360}deg)` }],
      { duration: DRIFT_MS, iterations: Infinity },
    );
  };

  /** Take over from the drift at exactly the angle it had reached. */
  const stopDrift = () => {
    const drift = driftRef.current;
    if (!drift) return;
    driftRef.current = null;
    const s = m.current;
    const t = Number(drift.currentTime ?? 0);
    s.angle += ((t % DRIFT_MS) / DRIFT_MS) * 360;
    s.lastSlot = slotOf(s.angle);
    paintRing();
    drift.cancel();
  };

  // Charging and spinning are driven frame by frame from script. The loop
  // only runs while one of them is happening. Everything it touches is written
  // straight to the DOM; none of it goes through React.
  const frame = (t: number) => {
    const s = m.current;
    const dt = Math.max(0, Math.min((t - s.last) / 1000, 0.1));
    s.last = t;

    if (s.anim) {
      const p = Math.min((t - s.anim.start) / s.anim.dur, 1);
      s.angle = s.anim.from + (s.anim.to - s.anim.from) * easeOut(p);
      const slot = slotOf(s.angle);
      if (slot !== s.lastSlot) {
        s.lastSlot = slot;
        sound.tak();
        buzz(TICK);
        // Web Animations restart the kick without forcing a layout, which
        // restarting a CSS class would do on every dancer that passes.
        const pointer = pointerRef.current;
        if (pointer && !reduceMotion.current) {
          kickRef.current?.cancel();
          kickRef.current = pointer.animate(KICK, { duration: 120, easing: "ease-out" });
        }
      }
      if (p >= 1) {
        s.anim = null;
        void settleRef.current();
      }
    } else if (s.charging) {
      s.charge = Math.min((t - s.chargeStart) / CHARGE_MS, 1);
      wheelRef.current?.style.setProperty("--charge", s.charge.toFixed(3));
      arcRef.current?.setAttribute(
        "stroke-dashoffset",
        String(CIRCUMFERENCE * (1 - s.charge)),
      );
      sound.humSet(s.charge);
      if (wheelRef.current) {
        wheelRef.current.dataset.full = String(s.charge >= 1);
      }
      s.angle += (IDLE_SPEED + s.charge * 140) * dt;
      s.lastSlot = slotOf(s.angle);
    }

    paintRing();
    if (s.anim || s.charging) {
      loop.current.raf = requestAnimationFrame(frame);
    } else {
      loop.current.running = false;
    }
  };

  const runLoop = () => {
    if (loop.current.running) return;
    loop.current.running = true;
    m.current.last = performance.now();
    loop.current.raf = requestAnimationFrame(frame);
  };

  const canSpin = () =>
    !m.current.anim &&
    !m.current.pending &&
    !latest.current.empty &&
    !latest.current.blocked;

  const settle = async () => {
    const s = m.current;
    const won = (await s.pending) ?? false;
    s.pending = null;
    s.won = null;
    const wheel = wheelRef.current;
    if (!wheel) return;
    if (won) {
      s.idle = false;
      setPhase("landed");
      if (ringRef.current) ringRef.current.dataset.win = "true";
      sound.dhol();
      latest.current.onPhase("landed", 0);
    } else {
      s.idle = true;
      setPhase("idle");
      startDrift();
      latest.current.onPhase("idle", 0);
    }
    latest.current.onSettled(won, wheel.getBoundingClientRect());
  };

  // The animation loop is set up once, so it reaches settle() through a ref.
  const settleRef = useRef(settle);
  useLayoutEffect(() => {
    settleRef.current = settle;
  });

  const startSpin = (power: number) => {
    if (!canSpin()) return;
    const s = m.current;
    stopDrift();
    clearWin();

    s.won = null;
    s.pending = latest.current
      .onSpin(power)
      .catch(() => false)
      .then((won) => {
        s.won = won;
        // Nobody to land on: don't make them sit through the whole spin.
        if (!won && s.anim) {
          s.anim = { from: s.angle, to: s.angle + 40, start: performance.now(), dur: 600 };
        }
        return won;
      });

    // Land dancer `winIndex` under the pointer after at least `turns` turns.
    s.winIndex = Math.floor(Math.random() * DANCERS);
    const turns = 4 + Math.round(power * 4);
    const from = s.angle;
    const to =
      Math.ceil((from + turns * 360 + s.winIndex * SLOT_DEG) / 360) * 360 -
      s.winIndex * SLOT_DEG;
    s.anim = {
      from,
      to,
      start: performance.now(),
      dur: reduceMotion.current ? SPIN_REDUCED_MS : SPIN_MIN_MS + power * SPIN_POWER_MS,
    };

    setPhase("spinning");
    arcRef.current?.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE));
    wheelRef.current?.style.setProperty("--charge", "0");
    sound.dhol(0);
    sound.dhol(0.18);
    if (power > 0.8) sound.dhol(0.36);
    buzz(power > 0.8 ? [30, 30, 30] : 20, false);
    runLoop();
    latest.current.onPhase("spinning", power);
  };

  useImperativeHandle(ref, () => ({
    spin: (power: number) => startSpin(power),
    reset: () => {
      clearWin();
      m.current.idle = true;
      if (!m.current.anim && !m.current.pending) {
        setPhase("idle");
        startDrift();
      }
    },
  }));

  useEffect(() => {
    // Any completed tap on the page (picking a city, a gender) unlocks audio,
    // so the very first spin already has sound.
    sound.install();
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    paintRing();
    startDrift();
    const l = loop.current;
    return () => {
      cancelAnimationFrame(l.raf);
      l.running = false;
      driftRef.current?.cancel();
      driftRef.current = null;
      sound.humStop();
    };
  }, []);

  const release = () => {
    // Letting go is a completed gesture: the moment phones allow audio.
    sound.unlock();
    const s = m.current;
    if (!s.charging) return;
    s.charging = false;
    sound.humStop();
    if (wheelRef.current) wheelRef.current.dataset.full = "false";
    startSpin(s.charge);
  };

  /** The browser took the touch for a scroll: drop the charge, don't spin. */
  const cancelCharge = () => {
    const s = m.current;
    if (!s.charging) return;
    s.charging = false;
    // No click follows a cancelled pointer, so nothing is left to swallow.
    s.pointerSpin = false;
    s.idle = true;
    sound.humStop();
    const wheel = wheelRef.current;
    if (wheel) {
      wheel.dataset.full = "false";
      wheel.style.setProperty("--charge", "0");
    }
    arcRef.current?.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE));
    clearWin();
    setPhase("idle");
    startDrift();
    latest.current.onPhase("idle", 0);
  };

  return (
    <div
      ref={wheelRef}
      className={styles.wheel}
      data-empty={empty}
      data-blocked={blocked}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* The dial: twelve garba dancers in red enamel on ivory, one per slot,
          the first at 12 o'clock. The only layer that turns. */}
      <div ref={ringRef} className={styles.ring} aria-hidden>
        <img className={styles.art} src="/brand/wheel/dial.webp" alt="" draggable={false} />
      </div>

      {/* On a landing, the dial dims except the slot under the pointer, and a
          warm light falls on the dancer there. */}
      <div className={styles.spot} aria-hidden />

      {/* The bezel stays put; the charge meter fills it and a band of light
          sweeps round it. */}
      <img className={`${styles.layer} ${styles.art}`} src="/brand/wheel/bezel.webp" alt="" draggable={false} aria-hidden />
      <div className={styles.layer} aria-hidden>
        <svg viewBox="0 0 320 320">
          <circle
            ref={arcRef}
            className={styles.chargeArc}
            cx="160"
            cy="160"
            r={RADIUS}
            fill="none"
            stroke="#FFD36B"
            strokeWidth="6"
            strokeLinecap="round"
            transform="rotate(-90 160 160)"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>
      </div>
      <div className={`${styles.layer} ${styles.sheen}`} aria-hidden />

      <img ref={pointerRef} className={styles.pointer} src="/brand/wheel/pointer.webp" alt="" draggable={false} aria-hidden />

      <button
        type="button"
        className={styles.garbo}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onPointerDown={(e) => {
          sound.unlock();
          if (!canSpin()) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          const s = m.current;
          stopDrift();
          s.pointerSpin = true;
          s.charging = true;
          s.charge = 0;
          s.chargeStart = performance.now();
          runLoop();
          setPhase("charging");
          sound.humStart();
          latest.current.onPhase("charging", 0);
        }}
        onPointerUp={release}
        onPointerCancel={cancelCharge}
        onClick={(e) => {
          if (m.current.pointerSpin) {
            m.current.pointerSpin = false;
            return;
          }
          sound.unlock();
          if (!m.current.anim && !m.current.pending) {
            if (latest.current.empty) {
              latest.current.onEmptyTap();
              return;
            }
            if (latest.current.blocked) {
              latest.current.onBlockedTap();
              return;
            }
          }
          // Keyboard (Enter/Space) arrives as a click with no pointer detail.
          if (e.detail === 0) startSpin(0.3);
        }}
      >
        {/* The Havmor wordmark, like the lid of a tub. It lifts as a spin
            charges and pulses while the wheel turns: transforms only. */}
        <span className={styles.lamp} aria-hidden>
          <img className={styles.product} src="/brand/havmor-wordmark.png" alt="" draggable={false} />
        </span>
        <span>{label}</span>
      </button>
    </div>
  );
}
