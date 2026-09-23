/**
 * MapLibre GL 6 draws tiles in a Web Worker that it loads by URL, and the
 * worker imports a shared chunk by relative path. Bundlers don't emit either
 * file, so they are served from public/maplibre/ instead — copied from the
 * installed package on every install, so the worker always matches the
 * library version. public/maplibre/ is git-ignored.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const out = join(import.meta.dirname, "..", "public", "maplibre");

mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}
console.log("maplibre worker copied to public/maplibre/");
