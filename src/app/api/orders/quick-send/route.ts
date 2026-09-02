import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { resolveConversationByPhone } from "@/lib/whatsapp/resolve-conversation";
import {
  sendMessageToConversation,
  SendMessageError,
} from "@/lib/whatsapp/send-message";

/**
 * "Send instruction" action on the inbox's order-search dialog. Given a
 * mobile number pulled from an order-search result, finds (or creates)
 * the contact + conversation for that number and sends a free-text
 * message — so an agent can reply to a customer's mobile/UTR/payment-id
 * straight from the search result, without first opening their thread.
 *
 * Reuses `resolveConversationByPhone` (the same find-or-create the
 * public API uses for phone-addressed sends) and the shared send core,
 * so this is just dashboard auth + rate limiting glued on top.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");

    const limit = checkRateLimit(`send:${userId}`, RATE_LIMITS.send);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = await request.json();
    const mobile: string | undefined = body?.mobile;
    const message: string | undefined = body?.message;
    const name: string | undefined = body?.name;

    if (!mobile || !message?.trim()) {
      return NextResponse.json(
        { error: "mobile and message are required" },
        { status: 400 },
      );
    }

    // The orders DB stores plain 10-digit Indian mobile numbers with no
    // country code. Default to +91 when we see exactly that shape so the
    // resolved contact carries a Meta-valid E.164 number; anything else
    // (already has a country code, or is a different length) is passed
    // through as-is.
    const digits = mobile.replace(/\D/g, "");
    const dialable = digits.length === 10 ? `91${digits}` : digits;

    const { conversationId, contactId } = await resolveConversationByPhone(
      supabase,
      accountId,
      dialable,
      name,
    );

    const result = await sendMessageToConversation(supabase, accountId, {
      conversationId,
      messageType: "text",
      contentText: message.trim(),
    });

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      contact_id: contactId,
      message_id: result.messageId,
      whatsapp_message_id: result.whatsappMessageId,
    });
  } catch (error) {
    if (error instanceof SendMessageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error in orders quick-send POST:", error);
    return toErrorResponse(error);
  }
}
