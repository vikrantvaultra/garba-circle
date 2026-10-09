/* eslint-disable @next/next/no-img-element */
import type { Flavour } from "@/lib/havmor";

/**
 * A Havmor product, photographed and cut out of its background, fitted
 * inside a box `size` px tall. A plain <img>: the files are already small
 * webp cut-outs in public/, so there is nothing for next/image to add.
 */
export function ProductShot({
  flavour,
  size,
  className = "",
  priority = false,
}: {
  flavour: Pick<Flavour, "image" | "name">;
  size: number;
  className?: string;
  /** Above the fold: load it straight away. */
  priority?: boolean;
}) {
  return (
    <img
      src={flavour.image}
      alt={flavour.name}
      height={size}
      width={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={`block object-contain ${className}`}
      style={{ height: size, width: "auto", maxWidth: "100%" }}
    />
  );
}
