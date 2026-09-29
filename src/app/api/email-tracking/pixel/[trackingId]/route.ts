import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import {
  getQueueEntryByTrackingId,
  createEmailEvent,
  eventExistsForTracking,
  incrementCampaignStat,
} from '@coldflow/db';
import { classifyPixelRequest } from '@/lib/openTrackingFilter';

/**
 * GET /api/email-tracking/pixel/[trackingId].png
 *
 * Tracking pixel endpoint - records email opens.
 * Returns a 1x1 transparent PNG image.
 */

// 1x1 transparent PNG in base64
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;

    // Extract tracking ID (remove .png extension if present)
    const cleanTrackingId = trackingId.replace(/\.png$/i, '');

    // Get queue entry by tracking ID
    const queueEntry = await getQueueEntryByTrackingId(cleanTrackingId);

    if (queueEntry) {
      // Get request metadata
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                       request.headers.get('x-real-ip') ||
                       'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      // Filter prefetcher hits (Gmail image proxy, Apple MPP, security
      // scanners, sub-send-window scans). Counting these as opens silently
      // inflates open-rate to noise.
      const classification = classifyPixelRequest({
        userAgent,
        ipAddress,
        sentAt: queueEntry.sentAt,
      });

      if (classification.isPrefetcher) {
        // Record as a discrete event (so debugging stays possible) but never
        // increment openCount.
        await createEmailEvent({
          id: nanoid(),
          queueId: queueEntry.id,
          trackingId: cleanTrackingId,
          eventType: 'opened',
          ipAddress,
          userAgent,
          timestamp: new Date(),
          metadata: {
            firstOpen: false,
            prefetcher: true,
            prefetcherReason: classification.reason,
          },
        });
        console.log(
          `Email pixel prefetcher: ${cleanTrackingId} (${classification.reason})`,
        );
      } else {
        const firstOpen = !(await eventExistsForTracking(
          cleanTrackingId,
          'opened',
          { excludePrefetcher: true },
        ));

        await createEmailEvent({
          id: nanoid(),
          queueId: queueEntry.id,
          trackingId: cleanTrackingId,
          eventType: 'opened',
          ipAddress,
          userAgent,
          timestamp: new Date(),
          metadata: { firstOpen },
        });

        if (firstOpen) {
          await incrementCampaignStat(queueEntry.campaignId, 'openCount');
        }

        console.log(`Email opened: ${cleanTrackingId} (first: ${firstOpen})`);
      }
    }

    // Always return the tracking pixel, even if tracking ID not found
    // This prevents breaking email rendering
    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': TRANSPARENT_PIXEL.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error tracking email open:', error);

    // Always return the pixel, never break email rendering
    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': TRANSPARENT_PIXEL.length.toString(),
      },
    });
  }
}
