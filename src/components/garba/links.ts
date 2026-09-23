import type { GarbaEvent } from "@/lib/garba/schema";

/** Opens Google Maps directions to the venue, in the app on phones. */
export function directionsUrl(event: Pick<GarbaEvent, "lat" | "lng" | "venue" | "city">): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${event.lat},${event.lng}`,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

/** "bookmyshow.com" from a full URL, for a compact source label. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
