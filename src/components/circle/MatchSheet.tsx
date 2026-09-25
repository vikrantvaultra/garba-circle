"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";
import { Sheet } from "@/components/Sheet";
import { SKILL_LEVELS } from "@/lib/constants";
import { TIER_KICKER, type Landing } from "@/lib/compat";
import { sound } from "@/lib/client/sound";
import { TIER_SCOOPS, jodiScoop } from "@/lib/havmor";
import { Scoop } from "@/components/brand/Scoop";
import { dancerColor, initials } from "./dancer";
import styles from "./match.module.css";

const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);

/**
 * Who the circle landed on. The number counts up to a compatibility score
 * built from what both of them actually chose, with the reason underneath.
 */
export function MatchSheet({
  open,
  landing,
  againNote,
  inviting,
  onAgain,
  onInvite,
  onClose,
}: {
  open: boolean;
  landing: Landing | null;
  /** Under "Spin again": how many are left, or that more are needed. */
  againNote: string;
  inviting: boolean;
  onAgain: () => void;
  onInvite: () => void;
  onClose: () => void;
}) {
  const inviteRef = useRef<HTMLButtonElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || !landing) return;
    sound.chime(landing.tier);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = landing.pct;
    const dur = reduce ? 1 : 1000;
    const start = performance.now();
    let last = -1;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const v = Math.round(target * easeOut(p));
      if (numRef.current) numRef.current.textContent = `${v}%`;
      if (barRef.current) barRef.current.style.width = `${v}%`;
      if (v !== last && v % 6 === 0) sound.count(v);
      last = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open, landing]);

  const p = landing?.profile;
  const scoop = landing ? jodiScoop(landing.profile.id, landing.tier) : null;
  const first = p?.name?.trim().split(/\s+/)[0] ?? "them";
  const level = SKILL_LEVELS.find((l) => l.key === p?.skillLevel);
  const meta = [
    [p?.age, p?.city ? `dancing in ${p.city}` : null].filter(Boolean).join(", "),
    level?.label.split(" / ")[0],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy="match-name"
      initialFocus={inviteRef}
      tier={landing?.tier}
    >
      <div className={landing ? styles[`tier_${landing.tier}`] : undefined}>
        <div className={styles.head}>
          <div
            className={styles.avatar}
            aria-hidden
            style={
              p && !p.avatarUrl
                ? {
                    background: `radial-gradient(circle, rgba(255,255,255,.35) 1.4px, transparent 2px) 0 0/10px 10px, ${dancerColor(p.id)}`,
                  }
                : undefined
            }
          >
            {p?.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p ? initials(p.name) : null}
          </div>
          <div className="min-w-0">
            <p className={styles.kicker}>{landing ? TIER_KICKER[landing.tier] : ""}</p>
            <h2 id="match-name" className={styles.name}>
              {p?.name ?? "A dancer"}
            </h2>
            {meta && <p className={styles.meta}>{meta}</p>}
          </div>
        </div>

        <div className={styles.compat}>
          <span ref={numRef} className={styles.num}>
            0%
          </span>
          <div className="flex-1">
            <div className={styles.bar}>
              <i ref={barRef} />
            </div>
            <small className={styles.reason}>{landing?.reason}</small>
          </div>
        </div>

        {p?.bio && <p className={styles.line}>{p.bio}</p>}

        {p && p.danceStyles.length > 0 && (
          <div
            className={`${styles.styles} ${p.bio ? "" : "mt-4"}`}
            aria-label="Favourite steps"
          >
            {p.danceStyles.map((s) => (
              <span key={s} data-shared={landing?.shared.includes(s)}>
                {s}
              </span>
            ))}
          </div>
        )}

        {landing && scoop && (
          <div className={styles.scoop}>
            <span className={styles.scoopArt} style={{ background: scoop.flavour.deep }}>
              <Scoop flavour={scoop.flavour} scoops={TIER_SCOOPS[landing.tier]} size={58} />
            </span>
            <span className="min-w-0">
              <span className="eyebrow block text-havmor">Your jodi scoop</span>
              <b className={styles.scoopName}>{scoop.flavour.name}</b>
              <small className={styles.scoopLine}>{scoop.line}</small>
            </span>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn-ghost h-auto py-3" onClick={onAgain}>
            <span>
              Spin again
              <small>{againNote}</small>
            </span>
          </button>
          <button
            ref={inviteRef}
            type="button"
            className="btn-primary active:btn-primary-active h-auto py-3 disabled:opacity-60"
            onClick={onInvite}
            disabled={inviting}
          >
            {inviting ? "Opening chat…" : `Send ${first} a dandiya`}
          </button>
        </div>
        <p className={styles.fine}>
          A dandiya opens a chat with {first} straight away. They can block or
          report at any time.
        </p>
      </div>
    </Sheet>
  );
}
