import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { searchOrders } from "@/lib/orders/search";

// Backs the inbox's order-search dialog: look up a purchase in the
// external biodata orders DB by mobile / UTR / payment id so an agent
// can find the right customer without leaving the CRM. Read-only —
// any account agent can search, same gate as sending a message.
export async function GET(request: Request) {
  try {
    const { userId } = await requireRole("agent");

    const limit = checkRateLimit(`orders-search:${userId}`, RATE_LIMITS.orderSearch);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 3) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchOrders(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error in orders search GET:", error);
    return toErrorResponse(error);
  }
}
