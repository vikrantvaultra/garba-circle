import { APP_NAME } from "@/lib/constants";

/** Two crossed dandiya sticks and a spark, the same mark as the garba map pin. */
export function DandiyaMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className={`block shrink-0 ${className}`}
      aria-hidden
    >
      <path d="M5.5 20.5 18.5 7.5M5.5 7.5l13 13" strokeWidth="2.3" />
      <path d="M5.5 20.5l1.9-1.9M18.5 20.5l-1.9-1.9" strokeWidth="3.6" />
      <path
        d="M12 1.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/**
 * The app's name as its logo: the dandiya mark and "Garba Circle" in the
 * display face. White on the red header; red anywhere else.
 */
export function Wordmark({
  size = 16,
  tone = "white",
  className = "",
}: {
  /** Font size of the name, in px. */
  size?: number;
  tone?: "white" | "red";
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-[0.35em] font-display font-black leading-none tracking-[-0.02em] ${
        tone === "white" ? "text-white" : "text-brand"
      } ${className}`}
      style={{ fontSize: size }}
    >
      <DandiyaMark size={Math.round(size * 1.3)} />
      {APP_NAME}
    </span>
  );
}
