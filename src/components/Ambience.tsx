/**
 * The backdrop: Havmor's vanilla cream, warmed with a blush of strawberry,
 * and over it a faint field of candy dots that fades out towards the edges.
 * Pure CSS, so the server and client render identical markup.
 *
 * Both sit on fixed layers of their own (translateZ promotes them), so
 * scrolling moves the page over them without repainting either.
 */
export function Ambience() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(90% 55% at 100% 35%, rgba(255,80,97,.10), transparent 70%), radial-gradient(80% 50% at 0% 80%, rgba(242,182,90,.14), transparent 70%), var(--color-vanilla)",
          transform: "translateZ(0)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(211,0,43,.08) 1.3px, transparent 1.8px)",
          backgroundSize: "24px 24px",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 60% at 50% 45%, #000 20%, transparent 80%)",
          maskImage:
            "radial-gradient(ellipse 75% 60% at 50% 45%, #000 20%, transparent 80%)",
          transform: "translateZ(0)",
        }}
      />
    </>
  );
}
