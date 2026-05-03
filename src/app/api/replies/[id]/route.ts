import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCampaignById,
  getReplyById,
  updateReplySuggestedFollowup,
} from "@coldflow/db";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

const PatchSchema = z.object({
  suggestedFollowup: z.string().min(1).max(20000),
});

/**
 * PATCH /api/replies/:id
 *
 * Edit the suggested follow-up text on a triaged reply. Used by the [Edit]
 * button on the warm-reply UI cards before the user clicks [Send].
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = PatchSchema.parse(body);

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

    const updated = await updateReplySuggestedFollowup(
      id,
      parsed.suggestedFollowup
    );
    return NextResponse.json({ success: true, reply: updated });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating reply:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update reply" },
      { status: 500 }
    );
  }
}
