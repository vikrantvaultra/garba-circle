/**
 * Reel symbols, drawn rather than emoji.
 *
 * Emoji render differently on every phone and always read as a toy. These are
 * flat gold-gradient glyphs that stay identical everywhere and let the machine
 * look like a machine.
 */

type IconProps = { className?: string };

const G = "url(#reelGold)";
const R = "url(#reelRani)";

/** One shared <defs> for every reel symbol on the page. */
export function ReelDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="reelGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6a3" />
          <stop offset="0.45" stopColor="#ffc247" />
          <stop offset="1" stopColor="#ff8a00" />
        </linearGradient>
        <linearGradient id="reelRani" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6aa8" />
          <stop offset="1" stopColor="#c2185b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Diya({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <path d="M24 9c3.4 3.9 5 6.6 5 9.1a5 5 0 0 1-10 0C19 15.6 20.6 12.9 24 9z" fill={R} />
      <path d="M10 27h28c0 6.2-6.3 10-14 10S10 33.2 10 27z" fill={G} />
      <ellipse cx="24" cy="26.6" rx="14" ry="3.4" fill="#ffeec2" opacity="0.85" />
    </svg>
  );
}

function Dandiya({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect x="21.4" y="7" width="5.2" height="34" rx="2.6" fill={G} transform="rotate(26 24 24)" />
      <rect x="21.4" y="7" width="5.2" height="34" rx="2.6" fill={G} transform="rotate(-26 24 24)" />
      <circle cx="15.2" cy="11.6" r="3.4" fill={R} />
      <circle cx="32.8" cy="11.6" r="3.4" fill={R} />
    </svg>
  );
}

function Dhol({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <path d="M13 16c0-2.2 4.9-4 11-4s11 1.8 11 4v16c0 2.2-4.9 4-11 4s-11-1.8-11-4V16z" fill={G} />
      <ellipse cx="24" cy="16" rx="11" ry="4" fill="#ffeec2" />
      <path d="M14.6 20.5 33.4 27M33.4 20.5 14.6 27" stroke={R} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Feather({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <path d="M24 6c7 0 12 5.4 12 12.4C36 26 30 31 24 34c-6-3-12-8-12-15.6C12 11.4 17 6 24 6z" fill={G} />
      <ellipse cx="24" cy="18" rx="5.4" ry="6.4" fill="#1b5f8c" />
      <ellipse cx="24" cy="18" rx="2.4" ry="3" fill={R} />
      <path d="M24 34v8" stroke={G} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function Matki({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <path d="M18 12h12l-1.6 5.2C33 19 36 23 36 27.6 36 33.9 30.6 39 24 39S12 33.9 12 27.6c0-4.6 3-8.6 7.6-10.4L18 12z" fill={G} />
      <path d="M15.4 26h17.2" stroke={R} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Marigold({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      {Array.from({ length: 8 }).map((_, i) => (
        <ellipse
          key={i}
          cx="24"
          cy="13.2"
          rx="4.6"
          ry="7.4"
          fill={G}
          transform={`rotate(${i * 45} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="5.6" fill={R} />
    </svg>
  );
}

function Chakra({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <circle cx="24" cy="24" r="15" stroke={G} strokeWidth="3" />
      <circle cx="24" cy="24" r="6.4" fill={R} />
      {Array.from({ length: 12 }).map((_, i) => (
        <circle
          key={i}
          cx={24 + 15 * Math.cos((i * Math.PI) / 6)}
          cy={24 + 15 * Math.sin((i * Math.PI) / 6)}
          r="2.1"
          fill={G}
        />
      ))}
    </svg>
  );
}

function Spark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <path d="M24 6c1.4 9.2 8.4 16.2 17.6 17.6C32.4 25 25.4 32 24 41.2 22.6 32 15.6 25 6.4 23.6 15.6 22.2 22.6 15.2 24 6z" fill={G} />
    </svg>
  );
}

export const REEL_SYMBOLS = [
  Diya,
  Dandiya,
  Dhol,
  Feather,
  Matki,
  Marigold,
  Chakra,
  Spark,
];
