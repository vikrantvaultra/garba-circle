/**
 * The festive backdrop: a slowly turning mandala and a field of rising diya
 * sparks. Positions are hard-coded rather than random so the server and client
 * render identical markup.
 */

const SPARKS = [
  { left: "6%",  delay: "0s",    dur: "11s", size: 5, hue: "#ffb627" },
  { left: "17%", delay: "2.4s",  dur: "9s",  size: 3, hue: "#ff2e7e" },
  { left: "28%", delay: "5.1s",  dur: "12s", size: 4, hue: "#ffd166" },
  { left: "39%", delay: "1.2s",  dur: "10s", size: 3, hue: "#00d2b8" },
  { left: "48%", delay: "6.8s",  dur: "13s", size: 5, hue: "#ffb627" },
  { left: "57%", delay: "3.6s",  dur: "9.5s", size: 3, hue: "#ff8a00" },
  { left: "66%", delay: "0.8s",  dur: "11.5s", size: 4, hue: "#ff2e7e" },
  { left: "74%", delay: "4.9s",  dur: "10.5s", size: 3, hue: "#ffd166" },
  { left: "83%", delay: "2.0s",  dur: "12.5s", size: 5, hue: "#ffb627" },
  { left: "92%", delay: "7.4s",  dur: "9.8s", size: 3, hue: "#6b8cff" },
];

export function Ambience() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Mandala / chakra ring, barely visible but it gives the sky depth. */}
      <svg
        className="absolute -top-28 left-1/2 h-[520px] w-[520px] -translate-x-1/2 animate-spin-slow opacity-[0.13]"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="96" stroke="#f5c542" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="74" stroke="#ff2e7e" strokeWidth="0.6" strokeDasharray="3 5" />
        <circle cx="100" cy="100" r="52" stroke="#00d2b8" strokeWidth="0.6" />
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1="100"
            y1="100"
            x2={100 + 96 * Math.cos((i * Math.PI) / 12)}
            y2={100 + 96 * Math.sin((i * Math.PI) / 12)}
            stroke="#f5c542"
            strokeWidth="0.35"
          />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <circle
            key={i}
            cx={100 + 74 * Math.cos((i * Math.PI) / 6)}
            cy={100 + 74 * Math.sin((i * Math.PI) / 6)}
            r="3"
            fill="#ffb627"
          />
        ))}
      </svg>

      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full animate-float-up"
          style={{
            left: s.left,
            width: s.size,
            height: s.size,
            background: s.hue,
            boxShadow: `0 0 ${s.size * 3}px ${s.hue}`,
            animationDelay: s.delay,
            animationDuration: s.dur,
          }}
        />
      ))}

      {/* A warm floor glow, as if the garba ground is lit from below. */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(255,138,0,0.20),transparent_70%)]" />
    </div>
  );
}
