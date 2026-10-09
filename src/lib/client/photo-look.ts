/**
 * The "look" of a profile photo: light, contrast, colour and a filter.
 *
 * The editor previews a look with a CSS `filter` on the canvas, which every
 * browser draws. The saved photo can't rely on `ctx.filter` (older Safari
 * ignores it), so `applyLook` does the same maths on the pixels: each step
 * is the matrix the Filter Effects spec defines for that CSS function, in
 * the same order, clamped between steps as browsers do. What you see is
 * what gets saved.
 */

export type Look = {
  /** 1 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** 0 to 1: a warm, golden tone. */
  warmth: number;
  /** 0 to 1: black and white. */
  mono: number;
};

export const ORIGINAL: Look = { brightness: 1, contrast: 1, saturation: 1, warmth: 0, mono: 0 };

/** Warmth is sepia at up to 60%: enough to feel golden without going brown. */
const WARMTH_TO_SEPIA = 0.6;

export const FILTERS: { key: string; name: string; look: Look }[] = [
  { key: "original", name: "Original", look: ORIGINAL },
  { key: "kesar", name: "Kesar", look: { brightness: 1.05, contrast: 1.05, saturation: 1.2, warmth: 0.45, mono: 0 } },
  { key: "rajwadi", name: "Rajwadi", look: { brightness: 0.98, contrast: 1.2, saturation: 1.3, warmth: 0.25, mono: 0 } },
  { key: "vanilla", name: "Vanilla", look: { brightness: 1.12, contrast: 0.9, saturation: 0.85, warmth: 0.2, mono: 0 } },
  { key: "choco", name: "Choco", look: { brightness: 1, contrast: 1.1, saturation: 0.9, warmth: 1, mono: 0 } },
  { key: "classic", name: "Classic", look: { brightness: 1.03, contrast: 1.18, saturation: 1, warmth: 0, mono: 1 } },
];

export function isOriginal(look: Look): boolean {
  return (Object.keys(ORIGINAL) as (keyof Look)[]).every((k) => Math.abs(look[k] - ORIGINAL[k]) < 0.001);
}

/** The same look as a CSS filter, for the live preview. */
export function cssFilter(look: Look): string {
  return [
    `brightness(${look.brightness})`,
    `contrast(${look.contrast})`,
    `saturate(${look.saturation})`,
    `sepia(${look.warmth * WARMTH_TO_SEPIA})`,
    `grayscale(${look.mono})`,
  ].join(" ");
}

type Matrix = [number, number, number, number, number, number, number, number, number];

function saturateMatrix(s: number): Matrix {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
}

function sepiaMatrix(amount: number): Matrix {
  const a = 1 - Math.min(1, Math.max(0, amount));
  return [
    0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
    0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
    0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
  ];
}

function grayscaleMatrix(amount: number): Matrix {
  const a = 1 - Math.min(1, Math.max(0, amount));
  return [
    0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a,
  ];
}

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Applies a look to RGBA pixels in place, exactly as `cssFilter` would draw it. */
export function applyLook(pixels: Uint8ClampedArray, look: Look): void {
  if (isOriginal(look)) return;
  const sat = saturateMatrix(look.saturation);
  const sep = sepiaMatrix(look.warmth * WARMTH_TO_SEPIA);
  const gray = grayscaleMatrix(look.mono);
  const { brightness: b, contrast: c } = look;
  const offset = 0.5 - 0.5 * c;

  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i] / 255;
    let g = pixels[i + 1] / 255;
    let bl = pixels[i + 2] / 255;

    r = clamp(r * b);
    g = clamp(g * b);
    bl = clamp(bl * b);

    r = clamp(r * c + offset);
    g = clamp(g * c + offset);
    bl = clamp(bl * c + offset);

    for (const m of [sat, sep, gray]) {
      const nr = m[0] * r + m[1] * g + m[2] * bl;
      const ng = m[3] * r + m[4] * g + m[5] * bl;
      const nb = m[6] * r + m[7] * g + m[8] * bl;
      r = clamp(nr);
      g = clamp(ng);
      bl = clamp(nb);
    }

    pixels[i] = Math.round(r * 255);
    pixels[i + 1] = Math.round(g * 255);
    pixels[i + 2] = Math.round(bl * 255);
  }
}
