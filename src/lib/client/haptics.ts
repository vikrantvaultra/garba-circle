"use client";

/**
 * Haptics on both phone platforms.
 *
 * - Android (and anything with the Vibration API): navigator.vibrate. It
 *   only works after the person has tapped the page once, and pulses under
 *   ~10 ms are too short for most motors to be felt.
 * - iPhone: Safari has no Vibration API. From iOS 18, toggling an
 *   `<input type="checkbox" switch>` plays the system's light haptic tick,
 *   so a hidden switch is toggled instead. One tick per call; patterns
 *   become a few ticks in a row. Older iOS has no haptics for the web.
 */

type Pattern = number | number[];

let lastBuzz = 0;
let iosSwitch: HTMLLabelElement | null = null;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    // Rendered but invisible and untouchable, so toggling it never moves
    // focus, scrolls, or shows up for assistive tech.
    label.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

/**
 * Vibrate. `throttle` keeps the per-dancer ticks during a spin from merging
 * into one long buzz; one-off moments (landing, a blocked tap) pass false.
 */
export function buzz(pattern: Pattern, throttle = true) {
  if (typeof window === "undefined") return;
  const now = performance.now();
  if (throttle && now - lastBuzz < 45) return;
  lastBuzz = now;

  try {
    if (typeof navigator.vibrate === "function" && !isIOS()) {
      navigator.vibrate(pattern);
      return;
    }
    if (isIOS()) {
      iosTick();
      // A pattern becomes a short run of ticks, spaced like the original.
      if (Array.isArray(pattern)) {
        let at = 0;
        for (let i = 2; i < pattern.length; i += 2) {
          at += (pattern[i - 2] ?? 0) + (pattern[i - 1] ?? 0);
          setTimeout(iosTick, at);
        }
      }
    }
  } catch {
    /* haptics are a nicety, never an error */
  }
}

/** A single short tick, strong enough to feel: the pointer passing a dancer. */
export const TICK = 10;
