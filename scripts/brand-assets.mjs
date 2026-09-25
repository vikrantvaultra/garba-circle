/**
 * Builds the Havmor brand assets from their sources:
 *   src/app/icon.svg          -> public/icons/*.png and src/app/apple-icon.png
 *   public/brand/havmor-logo.png -> public/brand/havmor-wordmark.png
 *   brand-src/products/*        -> public/brand/products/*.webp (cut-outs)
 *   brand-src/wheel/*           -> public/brand/wheel/*.webp (spin wheel art)
 *
 * The wordmark is the logo's white lettering on its own, so it can sit on the
 * red header (and be tinted with a CSS mask anywhere else). Run it again after
 * swapping in the hi-res logo from Havmor's brand team:
 *   node scripts/brand-assets.mjs
 */
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..");
const icon = readFileSync(join(root, "src/app/icon.svg"));

// Square app icons, straight from the SVG.
for (const [file, size] of [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["src/app/apple-icon.png", 180],
]) {
  await sharp(icon, { density: 72 * (size / 64) }).resize(size, size).png().toFile(join(root, file));
}

// Maskable: launchers crop to a circle, so the mark sits inside the middle 80%
// on a full-bleed red square.
const inner = await sharp(icon, { density: 72 * (410 / 64) }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#d3002b" } })
  .composite([{ input: inner, top: 51, left: 51 }])
  .png()
  .toFile(join(root, "public/icons/maskable-512.png"));

// Notification badge: Android paints only the alpha, so a white silhouette.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="#fff">
  <circle cx="32" cy="8" r="3.4"/><circle cx="49" cy="15" r="3.4"/><circle cx="56" cy="32" r="3.4"/>
  <circle cx="49" cy="49" r="3.4"/><circle cx="32" cy="56" r="3.4"/><circle cx="15" cy="49" r="3.4"/>
  <circle cx="8" cy="32" r="3.4"/><circle cx="15" cy="15" r="3.4"/>
  <path d="M24.5 30.5h15L32 47z"/>
  <path d="M22.5 27a9.5 9.5 0 0 1 19 0c0 2.2-1.2 3.4-2.4 3.4-1.3 0-1.4 2.6-2.8 2.6s-1.4-2.6-2.9-2.6-1.4 3.6-2.9 3.6-1.5-3.6-2.9-3.6-1.5 2-2.8 2c-1.5 0-3.3-1.6-3.3-5.4z"/>
</svg>`;
await sharp(Buffer.from(badge), { density: 72 * 1.5 }).resize(96, 96).png().toFile(join(root, "public/icons/badge-96.png"));

// The white lettering: inside the red drip, how far a pixel is from red
// towards white is how much of it is letter. The logo's red (#de2138) has
// almost no green and white is all green, so green is the letter's coverage.
const RED_GREEN = 33;
const logo = sharp(join(root, "public/brand/havmor-logo.png")).ensureAlpha();
const { data, info } = await logo.raw().toBuffer({ resolveWithObject: true });
const out = Buffer.alloc(data.length);
for (let i = 0; i < data.length; i += 4) {
  const green = Math.max(0, data[i + 1] - RED_GREEN) / (255 - RED_GREEN);
  const coverage = green * (data[i + 3] / 255);
  out[i] = out[i + 1] = out[i + 2] = 255;
  out[i + 3] = Math.round(coverage * 255);
}
await sharp(out, { raw: info })
  .trim({ threshold: 1 })
  .png()
  .toFile(join(root, "public/brand/havmor-wordmark.png"));

// ---- Product cut-outs ----
// Havmor's product shots sit on a flat cream (#FFFDF1). Everything connected
// to the border in that colour becomes transparent, and the soft floor
// shadow under each pack is kept as a real translucent shadow, so the
// product sits as naturally on the red header as on a white card.
const BG = [255, 253, 241];
const SHADOW = [70, 45, 35];
const productsIn = join(root, "brand-src/products");
const productsOut = join(root, "public/brand/products");
mkdirSync(productsOut, { recursive: true });

/**
 * How far up from the bottom of the pack its floor shadow can reach, as a
 * share of the photo's height. Wide tubs cast a tall shadow beside them; packs
 * with a cream splash near the bottom (vanilla, strawberry) need a thin band
 * so the splash isn't taken for shadow.
 */
const SHADOW_BAND = {
  "choco-brownie": 0.3,
  "nutty-belgian": 0.3,
  rajwadi: 0.3,
  "kesar-pista": 0.3,
  vanilla: 0,
  strawberry: 0,
};

function cutout(data, width, height, band) {
  const n = width * height;
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const dist = ([r, g, b]) => Math.max(Math.abs(r - BG[0]), Math.abs(g - BG[1]), Math.abs(b - BG[2]));
  // Background, or a warm shadow darker than it on the floor under the pack.
  // Shadows only count in a band at the very bottom of the pack: higher up,
  // a cream-coloured pixel is more likely vanilla ice cream than shadow.
  let bottom = 0;
  for (let i = 0; i < n; i++) if (dist(px(i)) > 110) bottom = Math.floor(i / width);
  const floor = bottom - Math.floor(height * band);
  const passable = (i) => {
    const c = px(i);
    if (dist(c) <= 5) return true;
    if (i < floor * width) return false;
    const [r, g, b] = c;
    return r <= BG[0] && g <= BG[1] + 1 && b <= BG[2] + 1 && r - b >= 6 && r - b <= 40 && dist(c) <= 90;
  };
  const seen = new Uint8Array(n);
  const queue = [];
  for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) queue.push(y * width, y * width + width - 1);
  while (queue.length) {
    const i = queue.pop();
    if (seen[i] || !passable(i)) continue;
    seen[i] = 1;
    const x = i % width;
    if (x > 0) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (i >= width) queue.push(i - width);
    if (i < n - width) queue.push(i + width);
  }
  const out = Buffer.from(data);
  for (let i = 0; i < n; i++) {
    if (!seen[i]) continue;
    const c = px(i);
    if (dist(c) <= 5) {
      out[i * 4 + 3] = 0;
      continue;
    }
    // Shadow: how far from cream towards the shadow colour this pixel is.
    const a = Math.min(1, ((BG[0] - c[0]) + (BG[1] - c[1]) + (BG[2] - c[2])) / ((BG[0] - SHADOW[0]) + (BG[1] - SHADOW[1]) + (BG[2] - SHADOW[2])));
    out[i * 4] = SHADOW[0];
    out[i * 4 + 1] = SHADOW[1];
    out[i * 4 + 2] = SHADOW[2];
    out[i * 4 + 3] = Math.round(Math.min(1, a * 1.6) * 255);
  }
  // Soften the one-pixel seam where the product meets what was cut away.
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    const x = i % width;
    const near =
      (x > 0 && seen[i - 1] && out[(i - 1) * 4 + 3] === 0) ||
      (x < width - 1 && seen[i + 1] && out[(i + 1) * 4 + 3] === 0) ||
      (i >= width && seen[i - width] && out[(i - width) * 4 + 3] === 0) ||
      (i < n - width && seen[i + width] && out[(i + width) * 4 + 3] === 0);
    if (near) out[i * 4 + 3] = Math.min(out[i * 4 + 3], Math.max(90, Math.round((dist(px(i)) / 60) * 255)));
  }
  return out;
}

for (const file of readdirSync(productsIn)) {
  const name = file.replace(/\.(jpe?g|png)$/, "");
  const { data, info } = await sharp(join(productsIn, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cut = file.endsWith(".png") ? data : cutout(data, info.width, info.height, SHADOW_BAND[name] ?? 0.07);
  await sharp(cut, { raw: info })
    .trim({ threshold: 1 })
    .resize({ width: 560, height: 560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(join(productsOut, `${name}.webp`));
}

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
