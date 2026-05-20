import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  createQueueEntry,
  getCampaignById,
  getOriginalQueueEntry,
  getReplyById,
  markReplyActioned,
} from "@coldflow/db";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

const SUBJECT_PREFIX = "Re: ";

/**
 * POST /api/replies/:id/send
 *
 * One-click follow-up: create a pending row in `email_queue` for the same
 * recipient on the same email account that originally outreached, then mark
 * the triaged reply as `actioned`. Body text defaults to whatever the user
 * has saved in `suggested_followup`; a one-off override may be passed in the
 * request body without persisting it back to the reply row.
 *
 * Reuses the existing send pipeline — the queue worker picks the row up on
 * its next tick. No bypass paths.
 */
const SendBodySchema = z
  .object({
    bodyOverride: z.string().min(1).max(20000).optional(),
  })
  .optional();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    let bodyOverride: string | undefined;
    try {
      const json = await request.json();
      bodyOverride = SendBodySchema.parse(json)?.bodyOverride;
    } catch {
      // Empty body is allowed.
    }

    const reply = await getReplyById(id);
    if (!reply) {
      return NextResponse.json(
        { success: false, error: "Reply not found" },
        { status: 404 }
      );
    }
    const campaign = await getCampaignById(reply.campaignId);
    if (!campaign || campaign.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
    if (reply.status === "actioned") {
      return NextResponse.json(
        { success: false, error: "Reply already actioned" },
        { status: 409 }
      );
    }

    const original = await getOriginalQueueEntry(reply.contactId);
    if (!original) {
      return NextResponse.json(
        { success: false, error: "Original outbound row missing" },
        { status: 409 }
      );
    }

    const bodyText = bodyOverride ?? reply.suggestedFollowup;
    if (!bodyText.trim()) {
      return NextResponse.json(
        { success: false, error: "Follow-up body is empty" },
        { status: 400 }
      );
    }

    const subject = original.subject.startsWith(SUBJECT_PREFIX)
      ? original.subject
      : `${SUBJECT_PREFIX}${original.subject}`;

    const queueEntry = await createQueueEntry({
      id: nanoid(),
      campaignId: original.campaignId,
      emailAccountId: original.emailAccountId,
      recipientEmail: original.recipientEmail,
      recipientName: original.recipientName,
      subject,
      bodyText,
      bodyHtml: null,
      scheduledFor: new Date(),
      status: "pending",
      trackingId: nanoid(),
    });

    const updatedReply = await markReplyActioned(id, queueEntry.id);
    return NextResponse.json({
      success: true,
      reply: updatedReply,
      queueId: queueEntry.id,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error sending follow-up for reply:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send follow-up" },
      { status: 500 }
    );
  }
}
