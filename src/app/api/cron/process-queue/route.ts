import { NextRequest, NextResponse } from 'next/server';
import { processEmailQueue } from '@/lib/emailQueueProcessor';
import { verifyCronAuth } from '@/lib/cronAuth';

/**
 * /api/cron/process-queue
 *
 * Cron endpoint for processing the email queue. Accepts both GET (used by
 * Vercel Cron, which only sends GET) and POST (manual triggers / external
 * runners). Auth is `Authorization: Bearer $CRON_SECRET` for both.
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
    const result = await processEmailQueue(50);
    return NextResponse.json({
      success: true,
      result: {
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    console.error('Error in queue processing cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
