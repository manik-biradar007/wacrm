import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { fetchPurchaseBiodata, readPaymentId } from "@/lib/biodata/backend";

// Backs the order-lookup dialog's preview: fetches the full biodata for a
// purchase (by payment id) from the biodata backend, so the agent can see
// exactly what the customer paid for before sending it. Read-only — same
// agent gate as the order search itself.
export async function GET(request: Request) {
  try {
    const { userId } = await requireRole("agent");

    const limit = checkRateLimit(`orders-biodata:${userId}`, RATE_LIMITS.orderBiodata);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const paymentId = readPaymentId(request);
    if (!paymentId) {
      return NextResponse.json({ error: "A valid paymentId is required." }, { status: 400 });
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

    return NextResponse.json({
      paymentId,
      template: purchase.template,
      type: purchase.type,
      biodataInfo: purchase.biodataInfo,
    });
  } catch (error) {
    console.error("Error in order biodata GET:", error);
    return toErrorResponse(error);
  }
}
