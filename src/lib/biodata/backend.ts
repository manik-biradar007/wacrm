/**
 * Server-side access to the biodata backend the reference biodata site
 * uses — the AWS API that holds each purchase's `biodata_info` (keyed by
 * payment id), and the PHP `docx-convert` service that turns it into a
 * Word file. Ported from truebiodata `src/services/biodataService.ts`
 * (`getBiodata`, `generateWord`) and `src/config/payment.ts`.
 *
 * Server-only: called from the `/api/orders/biodata*` route handlers so
 * the browser never talks to either backend directly.
 */

import { getDefaultTemplateId, getTemplateById } from "./templates";
import type { BiodataInfo } from "./render";

// Same defaults the reference site ships with. Overridable per deployment.
const BIODATA_BACKEND_URL = (
  process.env.BIODATA_BACKEND_URL || "https://api.marriagebiodata.site"
).replace(/\/$/, "");
const DOCX_CONVERT_URL =
  process.env.BIODATA_DOCX_API_URL || "https://service.lagnapatrikadesign.in/docx-convert";

const BACKEND_TIMEOUT_MS = 15_000;
const DOCX_TIMEOUT_MS = 30_000;

/**
 * Reads and validates the `paymentId` query param. Payment ids are
 * `pay_…`-style tokens; anything outside a conservative charset is rejected
 * before it is forwarded to the backend.
 */
export function parsePaymentId(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9_-]{3,100}$/.test(value) ? value : null;
}

/** Reads the `paymentId` query param, validated by {@link parsePaymentId}. */
export function readPaymentId(request: Request): string | null {
  return parsePaymentId(new URL(request.url).searchParams.get("paymentId"));
}

/** A purchase's biodata as the reference backend returns it. */
export interface PurchaseBiodata {
  template: string;
  type: string | null;
  biodataInfo: BiodataInfo;
}

/** Abortable fetch with a hard timeout. Throws on network failure or timeout. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Looks up a purchase's biodata by payment id. Returns null when the
 * backend has no such purchase (or its record is empty). Throws when the
 * backend itself is unreachable, so the caller can report a 502.
 */
export async function fetchPurchaseBiodata(paymentId: string): Promise<PurchaseBiodata | null> {
  const res = await fetchWithTimeout(
    `${BIODATA_BACKEND_URL}/biodata?paymentId=${encodeURIComponent(paymentId)}`,
    { method: "GET" },
    BACKEND_TIMEOUT_MS,
  );
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    biodataInfo?: BiodataInfo;
    template?: string;
    type?: string;
  };
  if (!res.ok || !data.success || !data.biodataInfo || !data.biodataInfo.fields) {
    return null;
  }

  const biodataInfo: BiodataInfo = { ...data.biodataInfo };
  // The backend stores photos as root-relative paths for some records
  // (the reference's /support page makes the same fix-up) — resolve them
  // so the browser can load them directly.
  if (typeof biodataInfo.profilePicture === "string" && biodataInfo.profilePicture.startsWith("/images/")) {
    biodataInfo.profilePicture = `${BIODATA_BACKEND_URL}${biodataInfo.profilePicture}`;
  }

  return {
    template: data.template || getDefaultTemplateId(),
    type: data.type ?? null,
    biodataInfo,
  };
}

/** Largest god-icon data URL accepted for conversion (the icons are a few KB). */
const MAX_ICON_DATA_URL_CHARS = 2_000_000;
const ICON_DATA_URL = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

/**
 * Builds the body the docx converter expects — the stored biodata plus the
 * resolved template id and the god icon as a base64 data URL. Mirrors the
 * reference's `previewData` in its Word download handler.
 *
 * The icon is supplied by the browser (it fetches the icon from its own
 * origin, exactly as the reference does) rather than fetched here, because
 * this server cannot reliably fetch its own static assets. Returns null when
 * the supplied icon is not a usable image data URL.
 */
export function buildWordPayload(
  purchase: PurchaseBiodata,
  selectedGodIcon: string,
): Record<string, unknown> | null {
  if (
    selectedGodIcon.length > MAX_ICON_DATA_URL_CHARS ||
    !ICON_DATA_URL.test(selectedGodIcon)
  ) {
    return null;
  }

  const templateId = getTemplateById(purchase.template)?.id ?? getDefaultTemplateId();

  return {
    ...purchase.biodataInfo,
    template: templateId,
    selectedGodIcon,
  };
}

/** Sends a built payload to the docx converter and returns its response (a .docx body on success). */
export async function convertToWord(payload: Record<string, unknown>): Promise<Response> {
  return fetchWithTimeout(
    DOCX_CONVERT_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    DOCX_TIMEOUT_MS,
  );
}
