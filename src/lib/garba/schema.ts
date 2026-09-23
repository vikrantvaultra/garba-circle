import { z } from "zod";

/**
 * One public garba or dandiya event on the map. Every field comes from a
 * public source listed in `sources`; anything the sources did not say is
 * null rather than guessed.
 */
export const GarbaEventSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(2),
  venue: z.string().min(2),
  address: z.string().nullable(),
  lat: z.number().min(6).max(37),
  lng: z.number().min(68).max(98),
  /** How the pin was placed, e.g. which geocoder query found it. */
  coordsNote: z.string().nullable(),
  organiser: z.string().nullable(),
  dates: z.string().nullable(),
  timings: z.string().nullable(),
  entry: z.string().nullable(),
  artists: z.array(z.string()),
  kind: z.enum(["ticketed", "free", "members", "community"]),
  highlights: z.string().nullable(),
  /** "confirmed-2026" when a source announces this year's edition. */
  status: z.enum(["confirmed-2026", "recurring"]),
  sources: z.array(z.string().url()).min(1),
  lastChecked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type GarbaEvent = z.infer<typeof GarbaEventSchema>;
export type GarbaKind = GarbaEvent["kind"];

export const KIND_LABEL: Record<GarbaKind, string> = {
  ticketed: "Ticketed",
  free: "Free entry",
  members: "Club / members",
  community: "Community",
};

export type GarbaCity = {
  name: string;
  count: number;
  /** Where to centre the map before a city is picked. */
  lat: number;
  lng: number;
};
