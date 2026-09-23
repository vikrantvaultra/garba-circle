"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { CircleStats } from "@/lib/stats";

function ago(minutes: number): string {
  if (minutes <= 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/**
 * A live line under the header. Every number here is a real query against
 * the database — no invented "247 people viewing", no countdown that resets.
 * Recent pairings name a city, never a person. If the circle is quiet it says
 * so, because a proof that can be caught lying is worse than no proof.
 */
export function CircleLive({ initial }: { initial: CircleStats }) {
  const [stats, setStats] = useState(initial);
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const refresh = setInterval(async () => {
      try {
        setStats(await api.get<CircleStats>("/api/stats"));
      } catch {
        /* keep showing the last good numbers */
      }
    }, 45_000);

    let swap: ReturnType<typeof setTimeout>;
    const rotate = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => {
        setTick((t) => t + 1);
        setVisible(true);
      }, 350);
    }, 4500);
    return () => {
      clearInterval(refresh);
      clearInterval(rotate);
      clearTimeout(swap);
    };
  }, []);

  const lines: string[] = stats.recent
    .slice(0, 4)
    .map((row) => `A pair got talking in ${row.city}, ${ago(row.minutesAgo)}`);
  if (stats.jodisToday > 0) {
    lines.push(
      `${stats.jodisToday} ${stats.jodisToday === 1 ? "pair" : "pairs"} got talking today`,
    );
  }
  if (stats.city && stats.dancersInCity > 1) {
    lines.push(`${stats.dancersInCity} of them dance in ${stats.city}`);
  }
  if (lines.length === 0) {
    lines.push(
      stats.city
        ? `Be the first pair in ${stats.city} tonight`
        : "The circle is just getting started",
    );
  }
  const line = lines[tick % lines.length];

  return (
    <div className="mt-5 flex items-center gap-2.5 text-[14px] text-muted">
      <span aria-hidden className="relative h-2 w-2 shrink-0 rounded-full bg-parrot">
        <span className="absolute -inset-1 animate-pulse-ring rounded-full border-[1.5px] border-parrot" />
      </span>
      <p className="m-0 flex flex-wrap gap-x-2">
        <b className="font-semibold text-cream">
          {stats.dancers} {stats.dancers === 1 ? "dancer" : "dancers"} in the circle
        </b>
        <span
          className="transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {line}
        </span>
      </p>
    </div>
  );
}
