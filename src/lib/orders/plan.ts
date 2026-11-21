/**
 * Biodata plan rules, mirrored from the truebiodata site
 * (src/config/payment.ts BIODATA_TYPES): Silver = image, Gold = edit
 * (image + PDF), Platinum VIP = word (image + PDF + Word). Support
 * (re-download) is provided for 30 days from the purchase date.
 */

export type OrderBiodataFormat = "image" | "pdf" | "word";

export const SUPPORT_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_FORMATS: Record<string, OrderBiodataFormat[]> = {
  image: ["image"],
  edit: ["image", "pdf"],
  word: ["image", "pdf", "word"],
};

/** Formats a plan includes. Unknown/missing type falls back to the cheapest plan, as the site does. */
export function getPlanFormats(type: string | null | undefined): OrderBiodataFormat[] {
  return PLAN_FORMATS[(type ?? "").trim().toLowerCase()] ?? PLAN_FORMATS.image;
}

export function getPlanExpiry(createdOn: string): Date | null {
  const created = new Date(createdOn);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + SUPPORT_DAYS * DAY_MS);
}

/**
 * Whole days left in the support window (rounded up, so the last partial
 * day still counts as 1). Zero or negative once expired; null for an
 * unparseable date.
 */
export function getSupportDaysLeft(createdOn: string, now: Date = new Date()): number | null {
  const expiry = getPlanExpiry(createdOn);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
}

/** True once the 30-day support window has passed. An unparseable date is treated as not expired. */
export function isPlanExpired(createdOn: string, now: Date = new Date()): boolean {
  const expiry = getPlanExpiry(createdOn);
  return expiry ? now.getTime() > expiry.getTime() : false;
}
