"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { CircleStats } from "@/lib/stats";

/**
 * A live strip above the reel. Every number here is a real query against the
 * database — no invented "247 people viewing", no countdown that resets. If
 * the circle is quiet it says so, because a proof that can be caught lying is
 * worse than no proof.
 */
export function CircleLive({ initial }: { initial: CircleStats }) {
  const [stats, setStats] = useState(initial);
  const [tick, setTick] = useState(0);
  const tickerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const refresh = setInterval(async () => {
      try {
        setStats(await api.get<CircleStats>("/api/stats"));
      } catch {
        /* keep showing the last good numbers */
      }
    }, 45_000);

    const rotate = setInterval(() => setTick((t) => t + 1), 4200);
    return () => {
      clearInterval(refresh);
      clearInterval(rotate);
    };
  }, []);

  const lines: string[] = [];
  for (const row of stats.recent.slice(0, 4)) {
    lines.push(
      `A jodi formed in ${row.city} · ${row.minutesAgo}m ago`,
    );
  }
  if (stats.jodisToday > 0) {
    lines.push(
      `${stats.jodisToday} ${stats.jodisToday === 1 ? "jodi" : "jodis"} made today`,
    );
  }
  if (stats.city && stats.dancersInCity > 0) {
    lines.push(
      `${stats.dancersInCity} ${stats.dancersInCity === 1 ? "dancer" : "dancers"} in ${stats.city}`,
    );
  }
  if (lines.length === 0) {
    lines.push(
      stats.city
        ? `Be the first jodi in ${stats.city} tonight`
        : "The circle is just getting started",
    );
  }

  const line = lines[tick % lines.length];

  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 backdrop-blur-sm">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-peacock" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-peacock" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[13px] font-bold leading-tight">
          {stats.dancers} {stats.dancers === 1 ? "dancer" : "dancers"} in the
          circle
        </p>
        <span
          ref={tickerRef}
          key={line}
          className="block truncate text-[12px] leading-tight text-cream/55"
          style={{ animation: "rise 420ms ease-out both" }}
        >
          {line}
        </span>
      </div>
    </div>
  );
}
