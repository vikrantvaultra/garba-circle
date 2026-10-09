"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/components/Sheet";
import type { Tier } from "@/lib/compat";

export type SprinkleBurstHandle = {
  burst: (x: number, y: number, count: number, tier: Tier) => void;
};

type Sprinkle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  /** Length of a sprinkle, or the radius of a candy dot. */
  len: number;
  c: string;
  life: number;
  dot: boolean;
};

const PALETTES: Record<Tier, string[]> = {
  soulmate: ["#FFB81C", "#D3002B", "#FFFFFF", "#FF5061", "#4E9A3A"],
  rare: ["#FF5061", "#D3002B", "#FFB81C", "#FFFFFF"],
  jodi: ["#FF5061", "#4E9A3A", "#FFB81C", "#5B4FCF"],
};

/**
 * A shower of ice-cream sprinkles and the odd candy dot, drawn on one
 * full-screen canvas that only animates while something is falling.
 */
export function SprinkleBurst({ ref }: { ref?: Ref<SprinkleBurstHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sprinkles = useRef<Sprinkle[]>([]);
  const running = useRef(false);
  const rafRef = useRef(0);
  const isClient = useIsClient();

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      running.current = false;
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    burst(x, y, count, tier) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      // The canvas only has pixels while sprinkles fall. Sized per burst rather
      // than on resize: phones fire resize whenever the address bar slides,
      // and a full-screen canvas kept around costs tens of MB of GPU memory.
      if (!running.current) {
        const d = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(window.innerWidth * d);
        canvas.height = Math.round(window.innerHeight * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
      }
      const palette = PALETTES[tier];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * (tier === "soulmate" ? 9 : 6);
        sprinkles.current.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 3,
          r: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.3,
          len: 5 + Math.random() * 5,
          c: palette[i % palette.length],
          life: 1,
          dot: Math.random() < 0.2,
        });
      }
      if (running.current) return;
      running.current = true;

      const draw = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);
        sprinkles.current = sprinkles.current.filter((p) => p.life > 0);
        for (const p of sprinkles.current) {
          p.vy += 0.18;
          p.vx *= 0.985;
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
          p.life -= 0.009;
          ctx.save();
          ctx.globalAlpha = Math.max(p.life, 0);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.fillStyle = p.c;
          ctx.beginPath();
          if (p.dot) {
            ctx.arc(0, 0, p.len * 0.45, 0, Math.PI * 2);
          } else {
            // A rounded rod: a sprinkle.
            ctx.roundRect(-p.len / 2, -1.8, p.len, 3.6, 1.8);
          }
          ctx.fill();
          if (p.c === "#FFFFFF") {
            ctx.strokeStyle = "rgba(89, 51, 42, 0.25)";
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
          ctx.restore();
        }
        if (sprinkles.current.length) {
          rafRef.current = requestAnimationFrame(draw);
        } else {
          running.current = false;
          canvas.width = 0;
          canvas.height = 0;
        }
      };
      rafRef.current = requestAnimationFrame(draw);
    },
  }));

  // Portalled beside the sheets so the sprinkles fall over an open sheet too.
  if (!isClient) return null;
  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden
      width={0}
      height={0}
      className="pointer-events-none fixed inset-0 z-[55] h-full w-full"
    />,
    document.body,
  );
}
