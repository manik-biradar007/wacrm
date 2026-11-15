import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { fetchProfilePhoto, readPaymentId } from "@/lib/biodata/backend";

// Serves a purchase's profile photo from this origin. The browser can then
// draw it onto the preview canvas without a cross-origin request, which
// both avoids missing-CORS failures and keeps the canvas exportable.
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

    let photo;
    try {
      photo = await fetchProfilePhoto(paymentId);
    } catch (err) {
      console.error("[order-biodata] photo fetch failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "The profile photo is unavailable." }, { status: 502 });
    }
    if (!photo) {
      return NextResponse.json({ error: "No profile photo." }, { status: 404 });
    }

    return new Response(photo.bytes, {
      status: 200,
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error in order biodata photo GET:", error);
    return toErrorResponse(error);
  }
}
