import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQueueEntryByTrackingId } from "@coldflow/db";
import { recordInboundReply } from "@/lib/replyFollowup";

/**
 * POST /api/email-tracking/reply
 *
 * Webhook entry point for inbound replies. Whichever pipeline detects a
 * reply (Gmail watch webhook, IMAP poller, etc.) calls this endpoint with
 * the original outbound `trackingId` (or `queueId`) plus the reply body.
 *
 * Auth: Bearer GMAIL_WEBHOOK_SECRET — same shape used by the rest of
 * coldflow's tracking surface.
 */

const InboundReplySchema = z
  .object({
    trackingId: z.string().optional(),
    queueId: z.string().optional(),
    replyBody: z.string().min(1).max(50000),
    replyAt: z.string().datetime().optional(),
  })
  .refine((data) => data.trackingId || data.queueId, {
    message: "trackingId or queueId is required",
  });

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.GMAIL_WEBHOOK_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = InboundReplySchema.parse(body);

    let queueId = parsed.queueId;
    if (!queueId && parsed.trackingId) {
      const entry = await getQueueEntryByTrackingId(parsed.trackingId);
      if (entry) queueId = entry.id;
    }

    if (!queueId) {
      return NextResponse.json(
        { success: false, error: "Could not resolve original queue entry" },
        { status: 404 }
      );
    }

    const result = await recordInboundReply({
      contactQueueId: queueId,
      replyBody: parsed.replyBody,
      replyAt: parsed.replyAt ? new Date(parsed.replyAt) : undefined,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error recording inbound reply:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record reply" },
      { status: 500 }
    );
  }
}
