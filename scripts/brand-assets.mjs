/**
 * Builds the Havmor brand assets from their sources:
 *   src/app/icon.svg          -> public/icons/*.png and src/app/apple-icon.png
 *   public/brand/havmor-logo.png -> public/brand/havmor-wordmark.png
 *
 * The wordmark is the logo's white lettering on its own, so it can sit on the
 * red header (and be tinted with a CSS mask anywhere else). Run it again after
 * swapping in the hi-res logo from Havmor's brand team:
 *   node scripts/brand-assets.mjs
 */
import { readFileSync } from "node:fs";
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

console.log("brand assets written");
