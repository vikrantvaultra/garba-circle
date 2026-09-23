"use client";

/**
 * The circle's sound, synthesised with Web Audio so there are no files to
 * ship: a wooden "tak" as each dancer passes the pointer, a dhol hit when the
 * circle is thrown, a chime on landing and a hum that rises while charging.
 *
 * The on/off choice is a per-device convenience kept in localStorage.
 */

import type { Tier } from "@/lib/compat";

const KEY = "gc_sound_off_v1";
const EVENT = "gc-sound-change";

type Hum = { osc: OscillatorNode; gain: GainNode };

class CircleSound {
  private ac: AudioContext | null = null;
  private hum: Hum | null = null;

  get enabled(): boolean {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  }

  setEnabled(on: boolean) {
    try {
      if (on) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: the toggle still works for this page */
    }
    if (!on) this.humStop();
    window.dispatchEvent(new Event(EVENT));
  }

  subscribe = (onChange: () => void) => {
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  };

  /** Browsers only allow audio after a gesture, so every gesture calls this. */
  unlock() {
    if (!this.ac) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) this.ac = new Ctor();
      } catch {
        /* no audio on this device */
      }
    }
    if (this.ac?.state === "suspended") void this.ac.resume();
  }

  private ready(): AudioContext | null {
    return this.ac && this.enabled ? this.ac : null;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    vol = 0.15,
    when = 0,
    toFreq?: number,
  ) {
    const ac = this.ready();
    if (!ac) return;
    const t = ac.currentTime + when;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  tak() {
    this.tone(1900, 0.035, "triangle", 0.09);
    this.tone(950, 0.04, "square", 0.015);
  }

  dhol(when = 0) {
    this.tone(140, 0.32, "sine", 0.4, when, 48);
    this.tone(320, 0.05, "triangle", 0.06, when);
  }

  chime(tier: Tier) {
    const notes =
      tier === "soulmate"
        ? [523, 659, 784, 1047, 1319, 1568]
        : tier === "rare"
          ? [587, 740, 880, 1175]
          : [523, 659, 784];
    notes.forEach((n, i) => {
      this.tone(n, 0.9, "sine", 0.12, i * 0.08);
      this.tone(n * 2, 0.5, "sine", 0.03, i * 0.08);
    });
  }

  /** The soft tick while the compatibility number counts up. */
  count(value: number) {
    this.tone(600 + value * 6, 0.04, "triangle", 0.04);
  }

  humStart() {
    const ac = this.ready();
    if (!ac || this.hum) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.value = 90;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.035, ac.currentTime + 0.1);
    filter.type = "lowpass";
    filter.frequency.value = 700;
    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start();
    this.hum = { osc, gain };
  }

  humSet(charge: number) {
    if (this.hum && this.ac) {
      this.hum.osc.frequency.setTargetAtTime(90 + charge * 260, this.ac.currentTime, 0.05);
    }
  }

  humStop() {
    if (!this.hum || !this.ac) return;
    const { osc, gain } = this.hum;
    this.hum = null;
    gain.gain.setTargetAtTime(0, this.ac.currentTime, 0.04);
    osc.stop(this.ac.currentTime + 0.2);
  }
}

export const sound = new CircleSound();

let lastBuzz = 0;

/** Haptics, throttled so a fast spin does not become one long vibration. */
export function buzz(pattern: number | number[], throttle = true) {
  const now = performance.now();
  if (throttle && now - lastBuzz < 45) return;
  lastBuzz = now;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported, and entirely optional */
  }
}
