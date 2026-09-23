"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from "react";
import { buzz, sound } from "@/lib/client/sound";
import styles from "./wheel.module.css";

const DANCERS = 12;
const SLOT_DEG = 360 / DANCERS;
const COLORS = ["#F6A91B", "#D62845", "#37B26C", "#E23A93"];
const RADIUS = 155;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** How long a hold takes to reach full power. */
const CHARGE_MS = 1100;
/** Degrees per second the circle drifts at rest. */
const IDLE_SPEED = 7;

const round = (n: number) => Math.round(n * 100) / 100;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);
const slotOf = (angle: number) => Math.floor((angle + SLOT_DEG / 2) / SLOT_DEG);

// Mirror-work glints between the beads. Rounded so server and client agree.
const GLINTS = Array.from({ length: 8 }, (_, i) => {
  const a = ((i * 45 + 22.5) * Math.PI) / 180;
  const x = round(160 + 146 * Math.sin(a));
  const y = round(160 - 146 * Math.cos(a));
  return `M${x} ${round(y - 4)} L${round(x + 2.6)} ${y} L${x} ${round(y + 4)} L${round(x - 2.6)} ${y}Z`;
});

export type WheelPhase = "idle" | "charging" | "spinning" | "landed";

export type WheelHandle = {
  /** Throw the circle with a power between 0 and 1, as if released from a hold. */
  spin: (power: number) => void;
  /** Clear the winner's halo and let the circle drift again. */
  reset: () => void;
};

type Props = {
  ref?: Ref<WheelHandle>;
  /** No spins left: the garbo asks for more instead of spinning. */
  empty: boolean;
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
  const { ref, empty, label, ariaLabel, describedBy } = props;

  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const wheelRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const pointerRef = useRef<SVGSVGElement>(null);
  const dancerRefs = useRef<(SVGGElement | null)[]>([]);
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
    dancerRefs.current.forEach((d) => d && delete d.dataset.win);
  };

  const canSpin = () =>
    !m.current.anim && !m.current.pending && !latest.current.empty;

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
      const dancer = dancerRefs.current[s.winIndex];
      if (dancer) dancer.dataset.win = "true";
      sound.dhol();
      latest.current.onPhase("landed", 0);
    } else {
      s.idle = true;
      setPhase("idle");
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
    const turns = 3 + Math.round(power * 4);
    const from = s.angle;
    const to =
      Math.ceil((from + turns * 360 + s.winIndex * SLOT_DEG) / 360) * 360 -
      s.winIndex * SLOT_DEG;
    s.anim = {
      from,
      to,
      start: performance.now(),
      dur: reduceMotion.current ? 300 : 3400 + power * 1800,
    };

    setPhase("spinning");
    arcRef.current?.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE));
    wheelRef.current?.style.setProperty("--charge", "0");
    sound.dhol(0);
    sound.dhol(0.18);
    if (power > 0.8) sound.dhol(0.36);
    buzz(power > 0.8 ? [30, 30, 30] : 20, false);
    latest.current.onPhase("spinning", power);
  };

  useImperativeHandle(ref, () => ({
    spin: (power: number) => startSpin(power),
    reset: () => {
      clearWin();
      m.current.idle = true;
      if (!m.current.anim && !m.current.pending) setPhase("idle");
    },
  }));

  // One animation loop for the whole life of the component. Everything it
  // touches is written straight to the DOM; none of it goes through React.
  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const frame = (t: number) => {
      const s = m.current;
      const dt = Math.min((t - s.last) / 1000, 0.1);
      s.last = t;

      if (s.anim) {
        const p = Math.min((t - s.anim.start) / s.anim.dur, 1);
        s.angle = s.anim.from + (s.anim.to - s.anim.from) * easeOut(p);
        const slot = slotOf(s.angle);
        if (slot !== s.lastSlot) {
          s.lastSlot = slot;
          sound.tak();
          buzz(4);
          const pointer = pointerRef.current;
          if (pointer) {
            pointer.classList.remove(styles.kick);
            void pointer.getBoundingClientRect();
            pointer.classList.add(styles.kick);
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
      } else if (s.idle && !reduceMotion.current) {
        s.angle += IDLE_SPEED * dt;
        s.lastSlot = slotOf(s.angle);
      }

      if (ringRef.current) ringRef.current.style.transform = `rotate(${s.angle}deg)`;
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame((t) => {
      m.current.last = t;
      frame(t);
    });
    return () => {
      cancelAnimationFrame(raf);
      sound.humStop();
    };
  }, []);

  const release = () => {
    const s = m.current;
    if (!s.charging) return;
    s.charging = false;
    sound.humStop();
    if (wheelRef.current) wheelRef.current.dataset.full = "false";
    startSpin(s.charge);
  };

  return (
    <div
      ref={wheelRef}
      className={styles.wheel}
      data-empty={empty}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={styles.layer} aria-hidden>
        <svg viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="155" fill="none" stroke="#F6A91B" strokeOpacity=".75" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="0.1 9.6" />
          <circle
            ref={arcRef}
            className={styles.chargeArc}
            cx="160"
            cy="160"
            r={RADIUS}
            fill="none"
            stroke="#FFD66B"
            strokeWidth="5"
            strokeLinecap="round"
            transform="rotate(-90 160 160)"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
          <circle cx="160" cy="160" r="146" fill="none" stroke="#FBEFD9" strokeOpacity=".08" />
          <circle cx="160" cy="160" r="92" fill="none" stroke="#F6A91B" strokeOpacity=".18" strokeDasharray="2 5" />
          <g fill="#DDE3F2">
            {GLINTS.map((d) => (
              <path key={d} d={d} opacity=".55" />
            ))}
          </g>
        </svg>
      </div>

      <div ref={ringRef} className={`${styles.layer} ${styles.ring}`} aria-hidden>
        <svg viewBox="0 0 320 320">
          <defs>
            <radialGradient id="gc-halo">
              <stop offset="0" stopColor="#F6A91B" stopOpacity=".85" />
              <stop offset="1" stopColor="#F6A91B" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="160" cy="160" r="122" fill="none" stroke="#FBEFD9" strokeOpacity=".1" strokeWidth="18" />
          {Array.from({ length: DANCERS }, (_, i) => (
            <g
              key={i}
              ref={(node) => {
                dancerRefs.current[i] = node;
              }}
              className={styles.dancer}
              transform={`rotate(${i * SLOT_DEG} 160 160) translate(160 40)`}
            >
              <circle className={styles.halo} r="28" fill="url(#gc-halo)" />
              <g className={styles.fig}>
                <path d="M-9 -17 L-15 -25 M9 -17 L15 -25" stroke="#F6A91B" strokeWidth="2" strokeLinecap="round" />
                <path d="M-3 -8 L-9 -17 M3 -8 L9 -17" stroke="#F1D3AE" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M-3.6 -9 L3.6 -9 L11.5 11 Q0 15.5 -11.5 11 Z" fill={COLORS[i % COLORS.length]} />
                <path d="M-11.5 11 Q0 15.5 11.5 11" fill="none" stroke="#FBEFD9" strokeWidth="1.4" strokeDasharray="1 2.2" strokeLinecap="round" />
                <circle cy="-14.5" r="4.6" fill="#F1D3AE" />
                <path d="M-4.6 -15.5 A4.6 4.6 0 0 1 4.6 -15.5" fill="#2A1260" />
              </g>
            </g>
          ))}
        </svg>
      </div>

      <svg ref={pointerRef} className={styles.pointer} viewBox="0 0 20 26" aria-hidden>
        <path d="M10 26 C3 17 1 12 1 9 a9 9 0 0 1 18 0 c0 3 -2 8 -9 17Z" fill="#F6A91B" />
        <circle cx="10" cy="9" r="3.5" fill="#FBEFD9" />
      </svg>

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
          s.pointerSpin = true;
          s.charging = true;
          s.charge = 0;
          s.chargeStart = performance.now();
          setPhase("charging");
          sound.humStart();
          latest.current.onPhase("charging", 0);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onClick={(e) => {
          if (m.current.pointerSpin) {
            m.current.pointerSpin = false;
            return;
          }
          sound.unlock();
          if (latest.current.empty && !m.current.anim && !m.current.pending) {
            latest.current.onEmptyTap();
            return;
          }
          // Keyboard (Enter/Space) arrives as a click with no pointer detail.
          if (e.detail === 0) startSpin(0.3);
        }}
      >
        <svg viewBox="0 0 100 104" aria-hidden>
          <defs>
            <linearGradient id="gc-brass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFD66B" />
              <stop offset=".55" stopColor="#E0911F" />
              <stop offset="1" stopColor="#8A4B12" />
            </linearGradient>
            <linearGradient id="gc-fire" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#D62845" />
              <stop offset=".5" stopColor="#F6A91B" />
              <stop offset="1" stopColor="#FFE7A0" />
            </linearGradient>
            <filter id="gc-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g className={styles.flame} filter="url(#gc-glow)">
            <path d="M50 2 C58 14 60 22 50 32 C40 22 42 14 50 2Z" fill="url(#gc-fire)" />
            <path d="M50 14 C54 20 54 25 50 29 C46 25 46 20 50 14Z" fill="#FFF4D6" />
          </g>
          <path d="M39 38 L61 38 L59 46 L41 46Z" fill="#B8741A" />
          <ellipse cx="50" cy="38" rx="15" ry="3.6" fill="#FFD66B" />
          <path d="M41 46 C14 52 12 88 30 100 L70 100 C88 88 86 52 59 46 Z" fill="url(#gc-brass)" />
          <path d="M22 88 Q50 96 78 88" fill="none" stroke="#8A4B12" strokeWidth="1.6" strokeOpacity=".7" />
          <g className={styles.holes} filter="url(#gc-glow)">
            <circle cx="40" cy="58" r="2.4" />
            <circle cx="50" cy="56" r="2.4" />
            <circle cx="60" cy="58" r="2.4" />
            <circle cx="30" cy="69" r="2.4" />
            <circle cx="43" cy="68" r="2.4" />
            <circle cx="57" cy="68" r="2.4" />
            <circle cx="70" cy="69" r="2.4" />
            <circle cx="36" cy="80" r="2.4" />
            <circle cx="50" cy="79" r="2.4" />
            <circle cx="64" cy="80" r="2.4" />
          </g>
        </svg>
        <span>{label}</span>
      </button>
    </div>
  );
}
