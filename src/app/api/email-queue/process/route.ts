import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser, AuthorizationError } from '@/lib/authorization';
import { processEmailQueue } from '@/lib/emailQueueProcessor';

/**
 * POST /api/email-queue/process
 *
 * Manually trigger email queue processing.
 * Protected by session auth OR API key auth.
 *
 * Use this endpoint to:
 * - Process pending emails immediately
 * - Test the queue processing system
 * - Trigger sends from external cron jobs
 */

const ProcessRequestSchema = z.object({
  batchSize: z.number().min(1).max(100).optional().default(10),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate via session OR API key
    await getAuthenticatedUser(request);

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const { batchSize } = ProcessRequestSchema.parse(body);

    // Process the queue
    const result = await processEmailQueue(batchSize);

    return NextResponse.json({
      success: true,
      result: {
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined, // Limit errors returned
      },
    });
  } catch (error) {
    console.error('Error processing email queue:', error);

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process email queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
