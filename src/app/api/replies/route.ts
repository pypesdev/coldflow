import { NextRequest, NextResponse } from "next/server";
import {
  countRepliesByIntentForCampaigns,
  getCampaignsByUserId,
  listRepliesForCampaigns,
  ReplyIntent,
  ReplyTriageStatus,
} from "@coldflow/db";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

const VALID_INTENTS: ReplyIntent[] = ["interested", "objection", "not_now", "out_of_office"];
const VALID_STATUSES: ReplyTriageStatus[] = ["new", "actioned", "archived"];

/**
 * GET /api/replies
 *
 * Returns triaged replies across the user's campaigns plus per-intent counts
 * for the four UI tabs. Defaults to status=`new`. Pass `?intent=...` to scope
 * to a single bucket, `?status=archived` to surface the archive view.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const url = request.nextUrl;
    const intentParam = url.searchParams.get("intent");
    const statusParam = url.searchParams.get("status") ?? "new";

    const intent =
      intentParam && VALID_INTENTS.includes(intentParam as ReplyIntent)
        ? (intentParam as ReplyIntent)
        : undefined;
    const status = VALID_STATUSES.includes(statusParam as ReplyTriageStatus)
      ? (statusParam as ReplyTriageStatus)
      : "new";

    const campaigns = await getCampaignsByUserId(user.id, { limit: 500 });
    const campaignIds = campaigns.map((c) => c.id);

    const [replies, counts] = await Promise.all([
      listRepliesForCampaigns(campaignIds, { intent, status, limit: 200 }),
      countRepliesByIntentForCampaigns(campaignIds),
    ]);

    const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));

    return NextResponse.json({
      success: true,
      counts,
      replies: replies.map((r) => ({
        id: r.id,
        campaignId: r.campaignId,
        campaignName: campaignNameById.get(r.campaignId) ?? null,
        recipientEmail: r.recipientEmail,
        recipientName: r.recipientName,
        body: r.body,
        intent: r.intent,
        confidence: r.confidence,
        suggestedFollowup: r.suggestedFollowup,
        status: r.status,
        receivedAt: r.receivedAt,
        actionedAt: r.actionedAt,
        archivedAt: r.archivedAt,
      })),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error fetching replies:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch replies" },
      { status: 500 }
    );
  }
}
