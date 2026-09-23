/**
 * The festive backdrop: a faint field of mirror-work dots, strongest around
 * the top of the screen where the circle sits and fading out towards the
 * edges. Pure CSS, so the server and client render identical markup.
 */
export function Ambience() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(251,239,217,.08) 1.2px, transparent 1.7px)",
        backgroundSize: "22px 22px",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 55% at 50% 38%, #000 25%, transparent 80%)",
        maskImage:
          "radial-gradient(ellipse 70% 55% at 50% 38%, #000 25%, transparent 80%)",
      }}
    />
  );
}
