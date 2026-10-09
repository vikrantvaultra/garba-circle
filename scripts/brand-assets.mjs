/**
 * Builds the brand assets from their sources:
 *   the dandiya mark (below)  -> src/app/icon.png, src/app/apple-icon.png,
 *                                public/icons/*.png
 *   brand-src/wheel/*         -> public/brand/wheel/*.webp (spin wheel art)
 *
 *   node scripts/brand-assets.mjs
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..");

// The dandiya mark, drawn on a 24-unit grid: the same paths as DandiyaMark
// in src/components/brand/Wordmark.tsx.
const STICKS = `
  <path d="M5.5 20.5 18.5 7.5M5.5 7.5l13 13" stroke-width="2.3"/>
  <path d="M5.5 20.5l1.9-1.9M18.5 20.5l-1.9-1.9" stroke-width="3.6"/>`;
const SPARK = `M12 1.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z`;

const BRAND_RED = "#d3002b";
const CREAM = "#fff6e9";
const GOLD = "#ffd36b";

/** The mark `share` of the way across a `size` square, on `background`. */
function markSvg(size, share, { background, sticks, spark }) {
  const m = size * share;
  const off = (size - m) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ""}
  <g transform="translate(${off} ${off}) scale(${m / 24})" fill="none" stroke="${sticks}" stroke-linecap="round">
    ${STICKS}
    <path d="${SPARK}" fill="${spark}" stroke="none"/>
  </g>
</svg>`;
}

// Notification badge: Android paints only the alpha, so a white silhouette.
await sharp(Buffer.from(markSvg(96, 0.9, { sticks: "#fff", spark: "#fff" })))
  .png()
  .toFile(join(root, "public/icons/badge-96.png"));

// ---- App icons ----
// Cream sticks and a gold spark on the brand red, the app's own colours.
for (const [file, size] of [
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 180],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
]) {
  await sharp(Buffer.from(markSvg(size, 0.66, { background: BRAND_RED, sticks: CREAM, spark: GOLD })))
    .png()
    .toFile(join(root, file));
}
// Maskable: launchers crop to a circle, so the mark stays inside the middle
// 80% (the safe zone) of the full-bleed red.
await sharp(Buffer.from(markSvg(512, 0.5, { background: BRAND_RED, sticks: CREAM, spark: GOLD })))
  .png()
  .toFile(join(root, "public/icons/maskable-512.png"));

// ---- The spin wheel ----
// Generated art in brand-src/wheel/: the dial (turns), the bezel (a ring
// around it), the button (the middle) and the pointer. Generators never
// centre a circle exactly and leave coloured fringe in the soft edge, so
// each one is found, re-centred on a square canvas and trimmed to a clean
// anti-aliased circle (or ring). Their shadows are drawn in CSS instead.
const wheelIn = join(root, "brand-src/wheel");
const wheelOut = join(root, "public/brand/wheel");
mkdirSync(wheelOut, { recursive: true });

async function raw(file) {
  const { data, info } = await sharp(join(wheelIn, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Centre and radius of the solid part, and the radius of any hole in it. */
function findCircle({ data, width, height }) {
  const alpha = (x, y) => data[(y * width + x) * 4 + 3];
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha(x, y) > 200) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = Math.min(x1 - x0, y1 - y0) / 2;
  // A ring: walk out from the middle in four directions to the first solid pixel.
  let hole = 0;
  if (alpha(Math.round(cx), Math.round(cy)) < 50) {
    const found = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => {
      for (let d = 0; d < r; d++) if (alpha(Math.round(cx + dx * d), Math.round(cy + dy * d)) > 128) return d;
      return 0;
    });
    hole = Math.max(...found);
  }
  return { cx, cy, r, hole };
}

/** Re-centre on a square `size` canvas, keeping only what lies between `inner` and `outer`. */
async function cutCircle(file, name, size, { trim = 3 } = {}) {
  const img = await raw(file);
  const { cx, cy, r, hole } = findCircle(img);
  const half = Math.ceil(r + 2);
  // Padded first, in its own pass: sharp would otherwise crop before padding.
  const padded = await sharp(join(wheelIn, file))
    .ensureAlpha()
    .extend({ top: half, bottom: half, left: half, right: half, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const box = await sharp(padded)
    .extract({ left: Math.round(cx), top: Math.round(cy), width: 2 * half, height: 2 * half })
    .resize(size, size)
    .raw()
    .toBuffer();
  const scale = size / (2 * half);
  const outer = (r - trim) * scale;
  const inner = hole ? (hole + trim) * scale : 0;
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      // One pixel of anti-aliasing on each edge.
      const keep = Math.min(1, Math.max(0, outer - d + 0.5)) * (inner ? Math.min(1, Math.max(0, d - inner + 0.5)) : 1);
      const i = (y * size + x) * 4 + 3;
      box[i] = Math.round(box[i] * keep);
    }
  }
  await sharp(box, { raw: { width: size, height: size, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(join(wheelOut, `${name}.webp`));
  return { outer: outer / c, inner: inner / c };
}

const dial = await cutCircle("dial.png", "dial", 1024);
const bezel = await cutCircle("bezel.png", "bezel", 1024);
await cutCircle("button.png", "button", 512);
console.log(`wheel: bezel hole is ${(bezel.inner * 100).toFixed(1)}% of its radius, dial edge ${(dial.outer * 100).toFixed(1)}%`);

// The pointer came with the transparency checkerboard painted into it. The
// checkerboard (and the grey shadow on it) is unsaturated and light; the
// pointer is red and gold. Everything unsaturated that joins the border goes.
{
  const { data, width, height } = await raw("pointer.png");
  const n = width * height;
  const grey = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) <= 16 && r + g + b >= 420;
  };
  const gone = new Uint8Array(n);
  const queue = [];
  for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) queue.push(y * width, y * width + width - 1);
  while (queue.length) {
    const i = queue.pop();
    if (gone[i] || !grey(i)) continue;
    gone[i] = 1;
    const x = i % width;
    if (x > 0) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (i >= width) queue.push(i - width);
    if (i < n - width) queue.push(i + width);
  }
  const out = Buffer.from(data);
  for (let i = 0; i < n; i++) {
    if (gone[i]) {
      out[i * 4 + 3] = 0;
      continue;
    }
    // Soften the edge: a kept pixel beside a removed one is half covered.
    const x = i % width;
    const edge =
      (x > 0 && gone[i - 1]) || (x < width - 1 && gone[i + 1]) || (i >= width && gone[i - width]) || (i < n - width && gone[i + width]);
    if (edge) out[i * 4 + 3] = 140;
  }
  await sharp(out, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 1 })
    .resize({ height: 200 })
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(join(wheelOut, "pointer.webp"));
}

console.log("brand assets written");
