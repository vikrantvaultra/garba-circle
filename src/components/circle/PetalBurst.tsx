"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/components/Sheet";
import type { Tier } from "@/lib/compat";

export type PetalBurstHandle = {
  burst: (x: number, y: number, count: number, tier: Tier) => void;
};

type Petal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  c: string;
  life: number;
  mirror: boolean;
};

const PALETTES: Record<Tier, string[]> = {
  soulmate: ["#FFD66B", "#FFF4D6", "#F6A91B", "#E23A93"],
  rare: ["#E23A93", "#F6A91B", "#FBEFD9"],
  jodi: ["#F6A91B", "#D62845", "#FFD66B"],
};

/**
 * A shower of marigold petals and the odd mirror-work glint, drawn on one
 * full-screen canvas that only animates while something is falling.
 */
export function PetalBurst({ ref }: { ref?: Ref<PetalBurstHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petals = useRef<Petal[]>([]);
  const running = useRef(false);
  const rafRef = useRef(0);
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const size = () => {
      const d = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * d;
      canvas.height = window.innerHeight * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    window.addEventListener("resize", size);
    return () => {
      window.removeEventListener("resize", size);
      cancelAnimationFrame(rafRef.current);
      running.current = false;
    };
  }, [isClient]);

  useImperativeHandle(ref, () => ({
    burst(x, y, count, tier) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const palette = PALETTES[tier];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * (tier === "soulmate" ? 9 : 6);
        petals.current.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 3,
          r: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.3,
          w: 3 + Math.random() * 4,
          h: 6 + Math.random() * 6,
          c: palette[i % palette.length],
          life: 1,
          mirror: Math.random() < 0.15,
        });
      }
      if (running.current) return;
      running.current = true;

      const draw = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);
        petals.current = petals.current.filter((p) => p.life > 0);
        for (const p of petals.current) {
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
          ctx.fillStyle = p.mirror ? "#E8EEFA" : p.c;
          ctx.beginPath();
          if (p.mirror) {
            ctx.moveTo(0, -4);
            ctx.lineTo(3, 0);
            ctx.lineTo(0, 4);
            ctx.lineTo(-3, 0);
          } else {
            ctx.ellipse(0, 0, p.w, p.h, 0, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.restore();
        }
        if (petals.current.length) {
          rafRef.current = requestAnimationFrame(draw);
        } else {
          running.current = false;
          ctx.clearRect(0, 0, w, h);
        }
      };
      rafRef.current = requestAnimationFrame(draw);
    },
  }));

  // Portalled beside the sheets so the petals fall over an open sheet too.
  if (!isClient) return null;
  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55] h-full w-full"
    />,
    document.body,
  );
}
