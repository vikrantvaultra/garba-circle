/**
 * The user's OWN phone number — the one they log in with. Unrelated to the
 * moderation code, which is about numbers appearing inside chat text.
 */

export const INDIA_CC = "91";

/** Strip formatting and return digits only. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Accepts "9876543210", "+91 98765 43210", "09876543210" and returns the
 * canonical "919876543210", or null when it is not a valid Indian mobile.
 */
export function normalizeIndianMobile(input: string): string | null {
  let d = digitsOnly(input);
  if (d.length === 12 && d.startsWith(INDIA_CC)) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return INDIA_CC + d;
}

/** "919876543210" -> "+91 98765 43210" */
export function formatIndianMobile(stored: string): string {
  const local = stored.startsWith(INDIA_CC) ? stored.slice(2) : stored;
  if (local.length !== 10) return "+" + stored;
  return `+${INDIA_CC} ${local.slice(0, 5)} ${local.slice(5)}`;
}

/** "+91 98765 ***10" for display where the full number is unnecessary. */
export function maskIndianMobile(stored: string): string {
  const local = stored.startsWith(INDIA_CC) ? stored.slice(2) : stored;
  if (local.length !== 10) return "+" + stored;
  return `+${INDIA_CC} ${local.slice(0, 5)} •••${local.slice(8)}`;
}
