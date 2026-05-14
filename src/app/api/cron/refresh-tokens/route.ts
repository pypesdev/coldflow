import { NextRequest, NextResponse } from 'next/server';
import { refreshExpiringTokens } from '@/lib/tokenRefreshJob';
import { verifyCronAuth } from '@/lib/cronAuth';

/**
 * /api/cron/refresh-tokens
 *
 * Cron endpoint for refreshing expiring OAuth tokens. Accepts both GET (used
 * by Vercel Cron) and POST (manual triggers). Auth is
 * `Authorization: Bearer $CRON_SECRET` for both.
 *
 * Recommended frequency: every 30 minutes.
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
    const result = await refreshExpiringTokens();
    return NextResponse.json({
      success: true,
      result: {
        refreshed: result.refreshed,
        failed: result.failed,
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    console.error('Error in token refresh cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh tokens',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
