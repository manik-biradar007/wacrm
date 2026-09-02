import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { resolveConversationByPhone } from "@/lib/whatsapp/resolve-conversation";
import { SendMessageError } from "@/lib/whatsapp/send-message";

/**
 * "Open conversation" action on the inbox's order-search dialog — find
 * (or create) the contact + conversation for an order's mobile number
 * without sending anything, so an agent can jump straight to the
 * thread and take it from there (templates, history, etc).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");

    const limit = checkRateLimit(`orders-search:${userId}`, RATE_LIMITS.orderSearch);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = await request.json();
    const mobile: string | undefined = body?.mobile;
    const name: string | undefined = body?.name;
    if (!mobile) {
      return NextResponse.json({ error: "mobile is required" }, { status: 400 });
    }

    const digits = mobile.replace(/\D/g, "");
    const dialable = digits.length === 10 ? `91${digits}` : digits;

    const { conversationId, contactId } = await resolveConversationByPhone(
      supabase,
      accountId,
      dialable,
      name,
    );

    return NextResponse.json({
      conversation_id: conversationId,
      contact_id: contactId,
    });
  } catch (error) {
    if (error instanceof SendMessageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error in orders resolve-conversation POST:", error);
    return toErrorResponse(error);
  }
}
