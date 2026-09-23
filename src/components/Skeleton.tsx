import type { CSSProperties } from "react";

/**
 * A placeholder block for the loading screens. Each tab has a `loading.tsx`
 * built from these, so a tap on the bottom nav shows the next screen's shape
 * straight away while the server renders the real one.
 */
export function Bone({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden className={`skeleton ${className}`} style={style} />;
}
