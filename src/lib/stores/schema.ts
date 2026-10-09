import { z } from "zod";

/**
 * One Havmor outlet, as havmor.com/store-locator lists it. Names, addresses
 * and phone numbers are Havmor's own; only whitespace, HTML entities and a
 * few city spellings are tidied (see scripts/havmor-stores-import.ts).
 */
export const HavmorStoreSchema = z.object({
  /** "havmor-<node>", from the store's node id on havmor.com. */
  id: z.string().regex(/^havmor-\d+$/),
  name: z.string().min(2),
  type: z.enum(["parlour", "restaurant", "eatery"]),
  city: z.string().min(2),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  lat: z.number().min(6).max(37),
  lng: z.number().min(68).max(98),
  /**
   * Set when Havmor's listing had no usable pin and we placed one: says what
   * the pin sits on, so the map can say it marks the area.
   */
  coordsNote: z.string().nullable(),
});

export const HavmorStoreFileSchema = z.object({
  source: z.string().url(),
  fetchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stores: z.array(HavmorStoreSchema).min(1),
});

export type HavmorStore = z.infer<typeof HavmorStoreSchema>;
export type HavmorStoreType = HavmorStore["type"];

export const STORE_TYPE_LABEL: Record<HavmorStoreType, string> = {
  parlour: "Ice cream parlour",
  restaurant: "Havmor Restaurant",
  eatery: "Havmor Eatery",
};

/** The nearest store to a garba, worked out on the server for its card. */
export type NearbyStore = Pick<HavmorStore, "id" | "name" | "address" | "lat" | "lng"> & {
  km: number;
};
