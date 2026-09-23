"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BottomNav } from "@/components/BottomNav";
import { CityPicker } from "@/components/circle/CityPicker";
import { directionsUrl, hostOf } from "@/components/garba/links";
import { KIND_LABEL, type GarbaCity, type GarbaEvent, type GarbaKind } from "@/lib/garba/schema";
import styles from "./garba.module.css";

// Leaflet needs `window`; the map renders only in the browser.
const GarbaMap = dynamic(
  () => import("@/components/garba/GarbaMap").then((m) => m.GarbaMap),
  {
    ssr: false,
    loading: () => (
      <div className="ml-[calc(50%-50vw)] grid h-[min(60dvh,520px)] min-h-[340px] w-screen place-items-center bg-[#f2efe9] text-[14px] text-[#6b4a3a]">
        Loading the map…
      </div>
    ),
  },
);

const KINDS: GarbaKind[] = ["ticketed", "free", "community", "members"];

function formatChecked(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const ICONS: Record<string, ReactNode> = {
  dates: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  timings: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  entry: (
    <path d="M4 8.5V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v2.5a2.5 2.5 0 0 0 0 5V16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16v-2.5a2.5 2.5 0 0 0 0-5ZM14 5v12" />
  ),
  artists: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  organiser: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6M16 5.5a3 3 0 0 1 0 6M18 14.6c1.6.6 2.6 2 3 4.4" />
    </>
  ),
};

function Fact({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICONS[icon]}
      </svg>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: GarbaEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const place = [event.venue, event.address].filter(Boolean).join(", ");
  return (
    <li id={`garba-${event.id}`} className={styles.card} data-selected={selected}>
      <button type="button" className={styles.cardMain} onClick={onSelect} aria-pressed={selected}>
        <span className={styles.badges}>
          <span className={styles.kind}>
            <span className={styles.dot} data-kind={event.kind} aria-hidden />
            {KIND_LABEL[event.kind]}
          </span>
          <span className={styles.status} data-status={event.status}>
            {event.status === "confirmed-2026"
              ? "Confirmed for 2026"
              : "Held every year · 2026 details not out yet"}
          </span>
        </span>
        <span className={`${styles.name} block`}>{event.name}</span>
        <span className={`${styles.venue} block`}>{place}</span>
      </button>

      <dl className={styles.facts}>
        {event.dates && <Fact icon="dates" label="Dates">{event.dates}</Fact>}
        {event.timings && <Fact icon="timings" label="Timings">{event.timings}</Fact>}
        {event.entry && <Fact icon="entry" label="Entry">{event.entry}</Fact>}
        {event.artists.length > 0 && (
          <Fact icon="artists" label="Artists">{event.artists.join(", ")}</Fact>
        )}
        {event.organiser && <Fact icon="organiser" label="Organiser">{event.organiser}</Fact>}
      </dl>

      {event.highlights && <p className={styles.highlights}>{event.highlights}</p>}

      <div className={styles.actions}>
        <a className={styles.directions} href={directionsUrl(event)} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.6" />
          </svg>
          Directions
        </a>
        {event.sources.map((url) => (
          <a key={url} className={styles.source} href={url} target="_blank" rel="noopener noreferrer">
            Source: {hostOf(url)}
          </a>
        ))}
      </div>
    </li>
  );
}

/**
 * The home screen: pick a city, see every garba we know of there on a map,
 * with dates, timings, entry and where the information came from.
 */
export function GarbaScreen({
  events,
  cities,
  initialCity,
  myCity,
  status,
  checkedOn,
  signedIn,
}: {
  events: GarbaEvent[];
  cities: GarbaCity[];
  initialCity: string | null;
  myCity: string | null;
  status: string | null;
  checkedOn: string | null;
  signedIn: boolean;
}) {
  const [city, setCity] = useState<string | null>(initialCity);
  const [kind, setKind] = useState<GarbaKind | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inCity = useMemo(
    () =>
      city
        ? events
            .filter((e) => e.city === city)
            .sort(
              (a, b) =>
                Number(b.status === "confirmed-2026") - Number(a.status === "confirmed-2026") ||
                a.name.localeCompare(b.name),
            )
        : [],
    [events, city],
  );
  const kindsHere = KINDS.filter((k) => inCity.some((e) => e.kind === k));
  // Stable between renders: the map redraws and re-fits whenever this changes.
  const shown = useMemo(
    () => (kind === "all" ? inCity : inCity.filter((e) => e.kind === kind)),
    [inCity, kind],
  );
  // Before a city is picked the map shows every garba, clustered by area.
  const onMap = city ? shown : events;

  const pickerCities = useMemo(
    () =>
      cities.map((c) => ({
        name: c.name,
        count: c.count,
        countLabel: `${c.count} ${c.count === 1 ? "garba" : "garbas"}`,
      })),
    [cities],
  );

  const chooseCity = (next: string | null) => {
    setCity(next);
    setKind("all");
    setSelectedId(null);
    // Shareable, and survives a refresh. Next keeps its router in sync with
    // the native History API.
    const url = next ? `/garba?city=${encodeURIComponent(next)}` : "/garba";
    window.history.replaceState(null, "", url);
  };

  const selectFromList = (id: string) => {
    setSelectedId(id);
    document.getElementById("garba-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectFromMap = (id: string) => {
    // A pin tapped on the India-wide view opens its city with it chosen.
    const event = events.find((e) => e.id === id);
    if (event && event.city !== city) chooseCity(event.city);
    setSelectedId(id);
    document
      .getElementById(`garba-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <main className="app-shell min-h-dvh pb-[calc(env(safe-area-inset-bottom,0px)+120px)] pt-[calc(env(safe-area-inset-top,0px)+28px)]">
      {/* The other half of the app: someone to dance with once you're there. */}
      <Link href="/spin" className={styles.partner}>
        <span className={styles.partnerIcon} aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <b>Find a garba partner</b>
          <small>Spin the circle and meet someone to dance with</small>
        </span>
        <svg className={styles.partnerArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      <header className={`${styles.top} mt-7`}>
        <p className={styles.gu} lang="gu" aria-hidden>
          ગરબા
        </p>
        <h1>Where&rsquo;s the garba?</h1>
        <p className={styles.sub}>
          {status ? `${status} ` : ""}Pick a city to see every garba on the map.
        </p>
      </header>

      <section className={styles.picker} aria-label="Choose a city">
        <label className={styles.q} htmlFor="garba-city">
          Which city?
        </label>
        <CityPicker
          id="garba-city"
          options={pickerCities}
          value={city}
          myCity={myCity}
          placeholder="Search a city"
          noneText={(q) => `No garbas listed in ${q} yet.`}
          onChange={chooseCity}
        />
      </section>

      {city && kindsHere.length > 1 && (
        <div className={styles.filters} role="group" aria-label="Filter by kind">
          <button type="button" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
            All {inCity.length}
          </button>
          {kindsHere.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              <span className={styles.dot} data-kind={k} aria-hidden />
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      <div className={styles.mapWrap}>
        <GarbaMap
          events={onMap}
          city={city}
          selectedId={selectedId}
          total={city ? inCity.length : events.length}
          onSelect={selectFromMap}
        />
      </div>

      {!city ? (
        <div className={styles.empty}>
          <b>{cities.reduce((n, c) => n + c.count, 0)} garbas in {cities.length} cities.</b>{" "}
          Pick a city above, or tap a circle on the map to zoom in.
          <div className={styles.cityGrid}>
            {cities.slice(0, 8).map((c) => (
              <button key={c.name} type="button" className="chip" onClick={() => chooseCity(c.name)}>
                {c.name} <span className="text-muted">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <section aria-label={`Garbas in ${city}`}>
          <div className={styles.listHead}>
            <h2>
              {shown.length} {shown.length === 1 ? "garba" : "garbas"} in {city}
            </h2>
          </div>
          <p className={styles.note}>
            Gathered from organisers, ticketing sites and news
            {checkedOn ? `, checked on ${formatChecked(checkedOn)}` : ""}. Some pins mark
            the area rather than the exact gate, and dates and passes change, so
            confirm with the organiser before you go.
          </p>
          <ul className={styles.list}>
            {shown.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                selected={event.id === selectedId}
                onSelect={() => selectFromList(event.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {!signedIn && (
        <div className={`${styles.empty} mt-6`}>
          <b>Going to a garba?</b> Find someone to dance with on Garba Circle.{" "}
          <Link href="/login" className="font-semibold text-marigold underline underline-offset-4">
            Sign in
          </Link>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
