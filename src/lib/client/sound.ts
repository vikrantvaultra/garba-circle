"use client";

/**
 * The circle's sound, synthesised with Web Audio so there are no files to
 * ship: a wooden "tak" as each dancer passes the pointer, a dhol hit when the
 * circle is thrown, a chime on landing and a hum that rises while charging.
 *
 * Getting sound out of a phone takes more than desktop does:
 * - Browsers only start audio from a *completed* tap (pointerup, touchend,
 *   click, keydown); the start of a touch doesn't count. `install()` listens
 *   for every such gesture on the page, so audio is ready before the first
 *   spin and recovers after the phone suspends it (a call, the lock screen).
 * - Phone speakers can't reproduce much below ~200 Hz, so the dhol carries
 *   its punch in upper harmonics and a stick slap, not only in the thump.
 * - iPhones mute Web Audio with the silent switch. The page asks for the
 *   "playback" audio session, which videos and games use, so the sound
 *   plays; older iOS gets the same by playing a moment of silence through
 *   an <audio> element. The in-app toggle is the way to turn it off.
 *
 * The on/off choice is a per-device convenience kept in localStorage.
 */

import type { Tier } from "@/lib/compat";

const KEY = "gc_sound_off_v1";
const EVENT = "gc-sound-change";

type Hum = { osc: OscillatorNode; gain: GainNode };
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** 50 ms of silence as a WAV data URL, for the older-iOS unlock. */
function silentWav(): string {
  const rate = 8000;
  const samples = 400;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  text(36, "data");
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

class CircleSound {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hum: Hum | null = null;
  private installed = false;
  private silentPlayed = false;

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

  /**
   * Unlock audio on every completed gesture anywhere on the page. Cheap to
   * leave in place: once running, unlock() is a no-op.
   *
   * Also builds the audio context while the page is idle. Opening the audio
   * device takes tens of milliseconds on a phone (hundreds on a slow one);
   * done inside the first tap, it froze that tap and delayed whatever it
   * was for. A context made outside a gesture simply starts suspended, and
   * the tap only has to resume it, which is instant.
   */
  install() {
    if (this.installed || typeof document === "undefined") return;
    this.installed = true;
    const unlock = () => this.unlock();
    for (const type of ["pointerup", "touchend", "click", "keydown"]) {
      document.addEventListener(type, unlock, { capture: true, passive: true });
    }
    const prepare = () => {
      if (this.enabled) this.create();
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prepare, { timeout: 2500 });
    } else {
      setTimeout(prepare, 800);
    }
  }

  /** The context and its output chain, made once. Needs no gesture. */
  private create(): AudioContext | null {
    if (this.ac) return this.ac;
    // iPhone: ask for the media session so the silent switch doesn't mute us.
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession && nav.audioSession.type !== "playback") {
      try {
        nav.audioSession.type = "playback";
      } catch {
        /* unsupported value on this version */
      }
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ac = new Ctor();
      // Everything goes through one gain and a compressor, so the sounds
      // are loud on a phone speaker without clipping when they overlap.
      const compressor = ac.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      const master = ac.createGain();
      master.gain.value = 1;
      master.connect(compressor).connect(ac.destination);
      this.ac = ac;
      this.master = master;
      return ac;
    } catch {
      return null;
    }
  }

  /** Create or wake the audio context. Must run inside a completed gesture. */
  unlock() {
    if (typeof window === "undefined") return;
    // Every tap on the page lands here; once audio runs there is nothing to do.
    if (this.ac?.state === "running" || !this.enabled) return;

    const nav = navigator as AudioSessionNavigator;
    if (!nav.audioSession && !this.silentPlayed && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      // Older iOS: playing any <audio> switches the page to the media session.
      this.silentPlayed = true;
      try {
        const el = new Audio(silentWav());
        el.setAttribute("playsinline", "");
        void el.play().catch(() => {
          this.silentPlayed = false;
        });
      } catch {
        this.silentPlayed = false;
      }
    }

    const ac = this.create();
    if (!ac) return;
    // "suspended" before the first gesture; "interrupted" on iOS after a
    // call or the lock screen.
    if (ac.state !== "running") {
      void ac.resume().catch(() => {});
      // Old WebKit only fully unlocks once a buffer plays inside the gesture.
      try {
        const blip = ac.createBufferSource();
        blip.buffer = ac.createBuffer(1, 1, 22050);
        blip.connect(ac.destination);
        blip.start(0);
      } catch {
        /* nothing to unlock */
      }
    }
  }

  private ready(): { ac: AudioContext; out: GainNode } | null {
    if (!this.ac || !this.master || !this.enabled) return null;
    return { ac: this.ac, out: this.master };
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    vol = 0.15,
    when = 0,
    toFreq?: number,
  ) {
    const r = this.ready();
    if (!r) return;
    const { ac, out } = r;
    const t = ac.currentTime + when;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  /** A short burst of filtered noise: the stick hitting the drum skin. */
  private slap(when: number, freq: number, dur: number, vol: number) {
    const r = this.ready();
    if (!r) return;
    const { ac, out } = r;
    if (!this.noise) {
      const len = Math.floor(ac.sampleRate * 0.2);
      this.noise = ac.createBuffer(1, len, ac.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + when;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = freq;
    band.Q.value = 1.2;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(band).connect(gain).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  tak() {
    this.tone(1900, 0.035, "triangle", 0.14);
    this.tone(950, 0.04, "square", 0.03);
  }

  dhol(when = 0) {
    // Thump for good speakers and headphones…
    this.tone(150, 0.32, "sine", 0.45, when, 55);
    // …and body a phone speaker can actually play.
    this.tone(260, 0.2, "sine", 0.3, when, 130);
    this.tone(520, 0.08, "triangle", 0.12, when, 260);
    this.slap(when, 1800, 0.05, 0.35);
  }

  chime(tier: Tier) {
    const notes =
      tier === "soulmate"
        ? [523, 659, 784, 1047, 1319, 1568]
        : tier === "rare"
          ? [587, 740, 880, 1175]
          : [523, 659, 784];
    notes.forEach((n, i) => {
      this.tone(n, 0.9, "sine", 0.16, i * 0.08);
      this.tone(n * 2, 0.5, "sine", 0.04, i * 0.08);
    });
  }

  /** The soft tick while the compatibility number counts up. */
  count(value: number) {
    this.tone(600 + value * 6, 0.04, "triangle", 0.06);
  }

  humStart() {
    const r = this.ready();
    if (!r || this.hum) return;
    const { ac, out } = r;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    osc.type = "sawtooth";
    // Starts at 180 Hz rather than 90 so a phone speaker can voice it.
    osc.frequency.value = 180;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.05, ac.currentTime + 0.1);
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    osc.connect(filter).connect(gain).connect(out);
    osc.start();
    this.hum = { osc, gain };
  }

  humSet(charge: number) {
    if (this.hum && this.ac) {
      this.hum.osc.frequency.setTargetAtTime(180 + charge * 320, this.ac.currentTime, 0.05);
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

export { buzz, TICK } from "./haptics";
