import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildWordPayload,
  convertToWord,
  fetchPurchaseBiodata,
  parsePaymentId,
} from "@/lib/biodata/backend";

// Converts a purchase's biodata into a Word (.docx) file through the same
// docx-convert service the reference site uses. Runs here rather than in
// the browser so the converter is called server-to-server.
//
// POST because the body carries the god icon (a base64 data URL the browser
// inlines, as the reference does) — too large and awkward for a query string.
export async function POST(request: Request) {
  try {
    const { userId } = await requireRole("agent");

    const limit = checkRateLimit(`orders-biodata:${userId}`, RATE_LIMITS.orderBiodata);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = (await request.json().catch(() => null)) as
      | { paymentId?: unknown; selectedGodIcon?: unknown }
      | null;
    const paymentId = parsePaymentId(body?.paymentId);
    if (!paymentId || typeof body?.selectedGodIcon !== "string") {
      return NextResponse.json(
        { error: "A valid paymentId and selectedGodIcon are required." },
        { status: 400 },
      );
    }

    let purchase;
    try {
      purchase = await fetchPurchaseBiodata(paymentId);
    } catch (err) {
      console.error("[order-biodata] backend request failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "The biodata service is unavailable." }, { status: 502 });
    }
    if (!purchase) {
      return NextResponse.json({ error: "No biodata found for this payment ID." }, { status: 404 });
    }

    const payload = buildWordPayload(purchase, body.selectedGodIcon);
    if (!payload) {
      return NextResponse.json({ error: "The god icon is not a valid image." }, { status: 400 });
    }

    let upstream: Response;
    try {
      upstream = await convertToWord(payload);
    } catch (err) {
      console.error("[order-biodata] word conversion request failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "The Word converter is unavailable." }, { status: 502 });
    }

    if (!upstream.ok) {
      console.error("[order-biodata] word converter responded", upstream.status);
      return NextResponse.json({ error: "Couldn't generate the Word file." }, { status: 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="biodata-${paymentId}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error in order biodata Word POST:", error);
    return toErrorResponse(error);
  }
}
