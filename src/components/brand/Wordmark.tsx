/* eslint-disable @next/next/no-img-element */
import styles from "./brand.module.css";

/** The logo's lettering, 203 x 68 in the source file. */
const RATIO = 68 / 203;

/**
 * The Havmor wordmark. White is the lettering as drawn, for the red header.
 * Any other tone paints the same lettering through a CSS mask, so there is
 * one asset to swap when the hi-res logo arrives.
 */
export function Wordmark({
  width = 92,
  tone = "white",
  className = "",
}: {
  width?: number;
  tone?: "white" | "red";
  className?: string;
}) {
  const height = Math.round(width * RATIO);
  if (tone === "white") {
    return (
      <img
        src="/brand/havmor-wordmark.png"
        alt="Havmor Ice Cream"
        width={width}
        height={height}
        className={`block shrink-0 ${className}`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label="Havmor Ice Cream"
      className={`${styles.maskedMark} ${className}`}
      style={{ width, height }}
    />
  );
}

/** The drip logo itself: red, with the lettering knocked out. */
export function DripLogo({ width = 140, className = "" }: { width?: number; className?: string }) {
  return (
    <img
      src="/brand/havmor-logo.png"
      alt="Havmor Ice Cream"
      width={width}
      height={Math.round((width * 176) / 331)}
      className={`block shrink-0 ${className}`}
    />
  );
}
