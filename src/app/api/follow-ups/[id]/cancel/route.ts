import { NextRequest, NextResponse } from "next/server";
import {
  cancelReplyFollowup,
  getCampaignById,
  getReplyFollowupById,
} from "@coldflow/db";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

/**
 * POST /api/follow-ups/:id/cancel
 *
 * Cancels a scheduled silent-reply follow-up. Only the campaign owner can cancel.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const followup = await getReplyFollowupById(id);
    if (!followup) {
      return NextResponse.json(
        { success: false, error: "Follow-up not found" },
        { status: 404 }
      );
    }

    const campaign = await getCampaignById(followup.sequenceId);
    if (!campaign || campaign.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    if (followup.status !== "scheduled") {
      return NextResponse.json(
        { success: false, error: `Follow-up is already ${followup.status}` },
        { status: 409 }
      );
    }

    const updated = await cancelReplyFollowup(id, "cancelled_by_user");
    return NextResponse.json({ success: true, followup: updated });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error cancelling follow-up:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel follow-up" },
      { status: 500 }
    );
  }
}
