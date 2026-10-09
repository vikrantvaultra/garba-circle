/** Flavour colours, picked per dancer so the same person keeps theirs. */
const COLORS = ["#FF5061", "#4E9A3A", "#5B4FCF", "#E39A00"];

export function dancerColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((s) => Array.from(s)[0].toUpperCase())
    .join("");
}
