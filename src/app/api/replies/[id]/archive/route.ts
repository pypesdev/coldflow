import { NextRequest, NextResponse } from "next/server";
import {
  getCampaignById,
  getReplyById,
  markReplyArchived,
} from "@coldflow/db";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

/**
 * POST /api/replies/:id/archive
 *
 * Move a triaged reply to the archive view (status = 'archived'). Reversible
 * — the row is preserved, just hidden from the default tab queries.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

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

    const updated = await markReplyArchived(id);
    return NextResponse.json({ success: true, reply: updated });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error archiving reply:", error);
    return NextResponse.json(
      { success: false, error: "Failed to archive reply" },
      { status: 500 }
    );
  }
}
