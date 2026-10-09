import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { GARBA_EVENTS, garbaCities, lastChecked } from "@/lib/garba";
import { navratriStatus } from "@/lib/navratri";
import { flavourOfTheNight } from "@/lib/havmor";
import { HAVMOR_STORES, nearestStore } from "@/lib/stores";
import type { NearbyStore } from "@/lib/stores/schema";
import { GarbaScreen } from "./GarbaScreen";

export const metadata: Metadata = {
  title: "Garba map — Havmor Garba Circle",
  description:
    "Every Navratri garba and every Havmor store in India on one map, with dates, timings, entry and the nearest scoop.",
};

/** Public: anyone can look up where the garba is, signed in or not. */
export default async function GarbaPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string | string[] }>;
}) {
  const { city } = await searchParams;
  const requested = (Array.isArray(city) ? city[0] : city)?.trim().toLowerCase();
  const user = await getCurrentUser().catch(() => null);
  const cities = garbaCities();
  // Worked out here so the page only carries each card's one nearest store;
  // the map brings its own copy of every store.
  const nearby: Record<string, NearbyStore> = {};
  for (const event of GARBA_EVENTS) {
    const store = nearestStore(event);
    if (store) nearby[event.id] = store;
  }

  return (
    <GarbaScreen
      events={GARBA_EVENTS}
      cities={cities}
      initialCity={cities.find((c) => c.name.toLowerCase() === requested)?.name ?? null}
      myCity={user?.city ?? null}
      status={navratriStatus()}
      checkedOn={lastChecked()}
      signedIn={Boolean(user)}
      tonight={flavourOfTheNight()}
      nearby={nearby}
      storeCount={HAVMOR_STORES.length}
    />
  );
}
