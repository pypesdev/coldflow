import { NextRequest, NextResponse } from 'next/server';
import { processDueReplyFollowups } from '@/lib/replyFollowup';
import { verifyCronAuth } from '@/lib/cronAuth';

/**
 * /api/cron/process-followups
 *
 * Cron endpoint for processing scheduled silent-reply follow-ups. Accepts
 * both GET (used by Vercel Cron) and POST (manual triggers). Auth is
 * `Authorization: Bearer $CRON_SECRET` for both. Mirrors process-queue.
 *
 * Recommended frequency: every 5 minutes.
 */

async function handle(request: NextRequest) {
  const auth = verifyCronAuth({
    authorizationHeader: request.headers.get('authorization'),
    cronSecret: process.env.CRON_SECRET,
  });
  if (!auth.ok) {
    if (auth.status === 500) console.error('CRON_SECRET not configured');
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  try {
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
    console.error('Error in follow-up processing cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process follow-ups',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
