/* eslint-disable @next/next/no-img-element */

/** Flavour scoops: strawberry, mango, pista, blueberry, caramel. */
const GRADIENTS = [
  "from-strawberry to-havmor",
  "from-mango to-caramel",
  "from-pista to-[#2f6b22]",
  "from-blueberry to-[#372c9a]",
  "from-cone to-caramel",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * Avatars are either a Blob URL or an inline data URL, so a plain <img> is
 * used rather than next/image — there is no remote domain to configure and
 * the images are already compressed to a few tens of kilobytes.
 */
export function Avatar({
  src,
  name,
  size = 56,
  ring = true,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const ringClass = ring ? "ring-2 ring-white shadow-[0_0_0_4px_rgba(211,0,43,0.16)]" : "";

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "Dancer"}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${ringClass}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${pickGradient(name ?? "x")} ${ringClass}`}
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-black text-white"
        style={{ fontSize: size * 0.42 }}
      >
        {initial}
      </span>
    </div>
  );
}
