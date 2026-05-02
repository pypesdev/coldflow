import { NextRequest, NextResponse } from "next/server";
import {
  countPendingFollowupsForCampaigns,
  getCampaignsByUserId,
  listPendingFollowupsForCampaigns,
} from "@coldflow/db";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

/**
 * GET /api/follow-ups
 *
 * Returns the count and (optionally) a list of `scheduled` reply follow-ups
 * across the authenticated user's campaigns. Powers the dashboard "Pending
 * follow-ups" tile and click-through list.
 *
 * Query params:
 *   - mode=count   → return only `{ count }` (cheap, used for the tile)
 *   - mode=list    → also return `followups` array (default)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const mode = request.nextUrl.searchParams.get("mode") ?? "list";

    const campaigns = await getCampaignsByUserId(user.id, { limit: 500 });
    const campaignIds = campaigns.map((c) => c.id);

    if (mode === "count") {
      const count = await countPendingFollowupsForCampaigns(campaignIds);
      return NextResponse.json({ success: true, count });
    }

    const [count, followups] = await Promise.all([
      countPendingFollowupsForCampaigns(campaignIds),
      listPendingFollowupsForCampaigns(campaignIds, 100),
    ]);

    const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));

    return NextResponse.json({
      success: true,
      count,
      followups: followups.map((f) => ({
        id: f.id,
        sequenceId: f.sequenceId,
        sequenceName: campaignNameById.get(f.sequenceId) ?? null,
        recipientEmail: f.recipientEmail,
        lastReplyAt: f.lastReplyAt,
        lastReplyExcerpt: f.lastReplyExcerpt,
        scheduledSendAt: f.scheduledSendAt,
        status: f.status,
        createdAt: f.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error fetching follow-ups:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch follow-ups" },
      { status: 500 }
    );
  }
}
