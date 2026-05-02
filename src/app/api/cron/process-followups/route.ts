import { NextRequest, NextResponse } from "next/server";
import { processDueReplyFollowups } from "@/lib/replyFollowup";

/**
 * POST /api/cron/process-followups
 *
 * Cron endpoint for processing scheduled silent-reply follow-ups. Mirrors the
 * auth shape of /api/cron/process-queue (Bearer CRON_SECRET) so the same cron
 * runner can hit both.
 *
 * Recommended frequency: every 5 minutes.
 */

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { success: false, error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await processDueReplyFollowups(50);

    return NextResponse.json({
      success: true,
      result: {
        due: result.due,
        enqueued: result.enqueued,
        cancelled: result.cancelled,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    console.error("Error in follow-up processing cron:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process follow-ups",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Follow-up processing cron endpoint is healthy",
    endpoint: "/api/cron/process-followups",
    method: "POST",
  });
}
