/** Opens Google Maps directions to a garba or store, in the app on phones. */
export function directionsUrl(place: { lat: number; lng: number }): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${place.lat},${place.lng}`,
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
