"use client";

export type SpinButtonState = "ready" | "spinning" | "empty";

/** Crossed dandiya sticks, in currentColor so they sit dark on the gold dome. */
function CrossedSticks({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden>
      <g stroke="currentColor" strokeLinecap="round">
        <path d="M12 6 L28 34" strokeWidth="4.6" />
        <path d="M28 6 L12 34" strokeWidth="4.6" />
      </g>
      <circle cx="12" cy="6" r="3.1" fill="currentColor" />
      <circle cx="28" cy="6" r="3.1" fill="currentColor" />
      <circle cx="12" cy="34" r="3.1" fill="currentColor" />
      <circle cx="28" cy="34" r="3.1" fill="currentColor" />
    </svg>
  );
}

/**
 * The one control on the screen.
 *
 * A slot machine's lever is charming but says nothing on a phone — it reads as
 * decoration, and the pink knob on its own gave no clue what it did. This is
 * the real thing instead: a big gold dome carrying crossed dandiya and the
 * word SPIN, wrapped in a rotating ring that speeds up while the reels run.
 * It is 140px across, so it is also the easiest thing on the page to hit.
 */
export function SpinButton({
  state,
  onClick,
  size = 140,
}: {
  state: SpinButtonState;
  onClick: () => void;
  size?: number;
}) {
  const spinning = state === "spinning";
  const empty = state === "empty";

  const label = spinning ? "" : empty ? "MORE" : "SPIN";
  const aria = spinning
    ? "Spinning"
    : empty
      ? "Get more spins"
      : "Spin the reel";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={spinning}
      aria-label={aria}
      className="group relative grid shrink-0 place-items-center disabled:cursor-default"
      style={{ width: size, height: size }}
    >
      {/* Ambient glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[-18%] rounded-full blur-xl transition-opacity"
        style={{
          background:
            "radial-gradient(circle, rgba(255,138,0,0.55) 0%, transparent 68%)",
          opacity: empty ? 0.35 : spinning ? 0.95 : 0.7,
        }}
      />

      {/* Attention pulses, only while there is something to spin */}
      {state === "ready" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full border border-marigold/60"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full border border-rani/45"
            style={{ animationDelay: "1.2s" }}
          />
        </>
      )}

      {/* Rotating dashed ring */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          animation: `ring-rotate ${spinning ? "0.8s" : "16s"} linear infinite`,
          opacity: empty ? 0.45 : 1,
        }}
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="rgba(255,214,102,0.20)"
          strokeWidth="3"
        />
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="#ffc247"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="2 11"
        />
      </svg>

      {/* Bezel studs */}
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 4,
            height: 4,
            background: "rgba(255,230,163,0.75)",
            left: `calc(50% - 2px + ${Math.cos((i * Math.PI) / 4) * (size / 2 - 16)}px)`,
            top: `calc(50% - 2px + ${Math.sin((i * Math.PI) / 4) * (size / 2 - 16)}px)`,
            opacity: empty ? 0.3 : 0.85,
          }}
        />
      ))}

      {/* The dome */}
      <span
        className="relative grid place-items-center rounded-full transition-transform duration-150 group-active:scale-[0.94]"
        style={{
          width: size - 38,
          height: size - 38,
          background: empty
            ? "radial-gradient(circle at 34% 28%, #d9c9a6 0%, #b39a68 30%, #8a7444 70%, #5e4d2a 100%)"
            : "radial-gradient(circle at 34% 28%, #fff3d0 0%, #ffd97a 20%, #ffb627 46%, #ff8a00 76%, #c96a00 100%)",
          boxShadow: empty
            ? "0 8px 18px -8px rgba(0,0,0,0.8), inset 0 2px 5px rgba(255,255,255,0.35), inset 0 -7px 14px rgba(60,45,20,0.5)"
            : "0 16px 32px -10px rgba(255,138,0,0.85), inset 0 2px 6px rgba(255,255,255,0.8), inset 0 -9px 18px rgba(160,70,0,0.55)",
          animation:
            state === "ready" ? "dome-invite 2.8s ease-in-out infinite" : "none",
          color: empty ? "#2e2412" : "#4a1a00",
        }}
      >
        <span
          aria-hidden
          className="grid place-items-center"
          style={{
            animation: spinning ? "stick-twirl 0.8s linear infinite" : "none",
          }}
        >
          <CrossedSticks className="h-[30px] w-[30px]" />
        </span>
        {spinning ? (
          <span className="mt-1 flex items-end gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1.5 w-1.5 rounded-full bg-[#4a1a00]"
                style={{ animation: `dot-bounce 900ms ease-in-out ${i * 140}ms infinite` }}
              />
            ))}
          </span>
        ) : (
          <span className="mt-0.5 font-display text-[15px] font-extrabold tracking-[0.18em]">
            {label}
          </span>
        )}
      </span>
    </button>
  );
}
