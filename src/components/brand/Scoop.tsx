import type { Flavour } from "@/lib/havmor";

/** One scoop, centred on (0, 0) with a radius of 16, its drips hanging below. */
const SCOOP =
  "M-16 0A16 16 0 0 1 16 0C16 3.5 14.5 5 12.5 5 10.5 5 10.5 8.5 8 8.5 5.5 8.5 5.5 5 3 5 0.5 5 0.5 10-2.5 10-5.5 10-5.5 5-8 5-10.5 5-10.5 7-12.5 7-15 7-16 4.5-16 0Z";

/**
 * A waffle cone with one to three scoops of a flavour. The third scoop earns
 * a cherry. Pure SVG, so it scales from a 20px badge to a hero.
 */
export function Scoop({
  flavour,
  scoops = 1,
  size = 60,
  className = "",
}: {
  flavour: Pick<Flavour, "color" | "deep">;
  scoops?: number;
  /** Height in px. */
  size?: number;
  className?: string;
}) {
  const n = Math.max(1, Math.min(3, scoops));
  const lift = 17;
  // The top scoop's crown, and the cherry's stem above that.
  const top = 22 - lift * (n - 1) - (n === 3 ? 9 : 0);
  const height = 90 - top;
  return (
    <svg
      viewBox={`0 ${top} 60 ${height}`}
      width={(size * 60) / height}
      height={size}
      className={className}
      aria-hidden
    >
      <path d="M15 42h30L30 88z" fill="#F2B65A" />
      <path
        d="M18.5 46.5l17 10.5M22 42.5l17 10.5M26 60l10.5-6.5M21 51l17-10M24.5 63l9.5-6"
        stroke="#C7822B"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(30 ${40 - i * lift})`}>
          <path d={SCOOP} fill={flavour.color} stroke={flavour.deep} strokeOpacity=".35" strokeWidth="1.2" />
          <ellipse cx="-6" cy="-8" rx="4.5" ry="2.6" fill="#fff" opacity=".5" transform="rotate(-25 -6 -8)" />
        </g>
      ))}
      {n === 3 && (
        <g transform={`translate(30 ${40 - 2 * lift - 16})`}>
          <path d="M0 -1c1-5 4-7 7-8" stroke="#4E9A3A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle r="4.6" fill="#D3002B" />
          <circle cx="-1.6" cy="-1.6" r="1.3" fill="#fff" opacity=".7" />
        </g>
      )}
    </svg>
  );
}
