import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../client';
import {
  emailEvent,
  EmailEvent,
  InsertEmailEvent,
} from '../schema';

/**
 * Create a new email event
 */
export const createEmailEvent = async (data: InsertEmailEvent): Promise<EmailEvent> => {
  const results = await db
    .insert(emailEvent)
    .values(data)
    .returning();

  return results[0];
};

/**
 * Get events by queue ID
 */
export const getEventsByQueueId = async (queueId: string): Promise<EmailEvent[]> => {
  return await db
    .select()
    .from(emailEvent)
    .where(eq(emailEvent.queueId, queueId))
    .orderBy(emailEvent.timestamp);
};

/**
 * Get events by tracking ID
 */
export const getEventsByTrackingId = async (trackingId: string): Promise<EmailEvent[]> => {
  return await db
    .select()
    .from(emailEvent)
    .where(eq(emailEvent.trackingId, trackingId))
    .orderBy(emailEvent.timestamp);
};

/**
 * Check if a specific event type already exists for a tracking ID
 * (useful for preventing duplicate open tracking).
 *
 * `excludePrefetcher`: skip rows tagged `metadata.prefetcher === true`.
 * The pixel route writes those rows for Gmail/Apple/scanner hits so
 * "did a real human open this" can be answered without inflating counts.
 */
export const eventExistsForTracking = async (
  trackingId: string,
  eventType: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed',
  options: { excludePrefetcher?: boolean } = {}
): Promise<boolean> => {
  const filters = [
    eq(emailEvent.trackingId, trackingId),
    eq(emailEvent.eventType, eventType),
  ];
  if (options.excludePrefetcher) {
    filters.push(
      sql`(${emailEvent.metadata} -> 'prefetcher' IS NULL OR ${emailEvent.metadata} ->> 'prefetcher' <> 'true')`
    );
  }

  const results = await db
    .select({ id: emailEvent.id })
    .from(emailEvent)
    .where(and(...filters))
    .limit(1);

  return results.length > 0;
};

/**
 * Get event counts by type for a specific tracking ID
 */
export const getEventCountsByTrackingId = async (trackingId: string) => {
  const results = await db
    .select({
      eventType: emailEvent.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(emailEvent)
    .where(eq(emailEvent.trackingId, trackingId))
    .groupBy(emailEvent.eventType);

  return results.reduce((acc, row) => {
    acc[row.eventType] = row.count;
    return acc;
  }, {} as Record<string, number>);
};

/**
 * Get recent events across all campaigns (for monitoring/debugging)
 */
export const getRecentEvents = async (
  limit: number = 100,
  eventType?: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
): Promise<EmailEvent[]> => {
  let query = db
    .select()
    .from(emailEvent)
    .orderBy(desc(emailEvent.timestamp))
    .limit(limit);

  if (eventType) {
    query = query.where(eq(emailEvent.eventType, eventType)) as any;
  }

  return await query;
};
