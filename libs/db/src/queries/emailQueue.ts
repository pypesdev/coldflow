import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { db } from '../client';
import {
  emailQueue,
  EmailQueue,
  InsertEmailQueue,
  emailEvent,
} from '../schema';

/**
 * Create a single queue entry
 */
export const createQueueEntry = async (data: InsertEmailQueue): Promise<EmailQueue> => {
  const results = await db
    .insert(emailQueue)
    .values(data)
    .returning();

  return results[0];
};

/**
 * Bulk create queue entries (efficient for campaigns)
 */
export const bulkCreateQueueEntries = async (
  data: InsertEmailQueue[]
): Promise<EmailQueue[]> => {
  if (data.length === 0) return [];

  return await db
    .insert(emailQueue)
    .values(data)
    .returning();
};

/**
 * Get next pending emails for processing with row-level locking
 * Uses FOR UPDATE SKIP LOCKED to prevent concurrent processing
 */
export const getNextPendingEmails = async (limit: number = 10): Promise<EmailQueue[]> => {
  const now = new Date();

  // Note: Drizzle doesn't have built-in FOR UPDATE SKIP LOCKED support yet,
  // so we use raw SQL for the locking part
  return await db.execute(sql`
    SELECT * FROM ${emailQueue}
    WHERE ${emailQueue.status} = 'pending'
      AND ${emailQueue.scheduledFor} <= ${now}
    ORDER BY ${emailQueue.priority} DESC, ${emailQueue.scheduledFor} ASC
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `).then(result => result.rows as EmailQueue[]);
};

/**
 * Update queue entry status
 */
export const updateQueueStatus = async (
  id: string,
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'bounced',
  sentAt?: Date | null,
  errorMessage?: string | null
): Promise<EmailQueue | null> => {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (sentAt !== undefined) {
    updateData.sentAt = sentAt;
  }

  if (errorMessage !== undefined) {
    updateData.errorMessage = errorMessage;
  }

  const results = await db
    .update(emailQueue)
    .set(updateData)
    .where(eq(emailQueue.id, id))
    .returning();

  return results[0] || null;
};

/**
 * Increment attempt count for a queue entry
 */
export const incrementAttemptCount = async (id: string): Promise<EmailQueue | null> => {
  const results = await db
    .update(emailQueue)
    .set({
      attemptCount: sql`${emailQueue.attemptCount} + 1`,
      lastAttemptAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailQueue.id, id))
    .returning();

  return results[0] || null;
};

/**
 * Get queue statistics for a campaign
 */
export const getQueueStatsByCampaign = async (campaignId: string) => {
  const results = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${emailQueue.status} = 'pending')::int`,
      processing: sql<number>`count(*) filter (where ${emailQueue.status} = 'processing')::int`,
      sent: sql<number>`count(*) filter (where ${emailQueue.status} = 'sent')::int`,
      failed: sql<number>`count(*) filter (where ${emailQueue.status} = 'failed')::int`,
      bounced: sql<number>`count(*) filter (where ${emailQueue.status} = 'bounced')::int`,
    })
    .from(emailQueue)
    .where(eq(emailQueue.campaignId, campaignId));

  return results[0];
};

/**
 * Count pending emails for a given email account
 */
export const getPendingCountForEmailAccount = async (
  emailAccountId: string
): Promise<number> => {
  const results = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.emailAccountId, emailAccountId),
        eq(emailQueue.status, 'pending')
      )
    );

  return results[0]?.count ?? 0;
};

/**
 * Get failed emails that can be retried
 */
export const getFailedEmailsForRetry = async (): Promise<EmailQueue[]> => {
  return await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, 'failed'),
        sql`${emailQueue.attemptCount} < ${emailQueue.maxAttempts}`
      )
    );
};

/**
 * Clean up old successfully sent emails
 */
export const cleanupOldQueueEntries = async (daysOld: number): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const results = await db
    .delete(emailQueue)
    .where(
      and(
        eq(emailQueue.status, 'sent'),
        lte(emailQueue.sentAt, cutoffDate)
      )
    )
    .returning();

  return results.length;
};

/**
 * Get queue entries by campaign ID
 */
export const getQueueEntriesByCampaign = async (
  campaignId: string,
  limit?: number,
  offset?: number
): Promise<EmailQueue[]> => {
  let query = db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.campaignId, campaignId))
    .orderBy(emailQueue.createdAt);

  if (limit) {
    query = query.limit(limit) as any;
  }

  if (offset) {
    query = query.offset(offset) as any;
  }

  return await query;
};

/**
 * Get queue entry by tracking ID
 */
export const getQueueEntryByTrackingId = async (
  trackingId: string
): Promise<EmailQueue | null> => {
  const results = await db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.trackingId, trackingId))
    .limit(1);

  return results[0] || null;
};

/**
 * Cancel pending emails for a recipient (used for unsubscribe)
 */
export const cancelPendingEmailsForRecipient = async (
  recipientEmail: string
): Promise<number> => {
  const results = await db
    .update(emailQueue)
    .set({
      status: 'failed',
      errorMessage: 'Recipient unsubscribed',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(emailQueue.recipientEmail, recipientEmail),
        eq(emailQueue.status, 'pending')
      )
    )
    .returning();

  return results.length;
};

/**
 * Get queue entry with related events
 */
export const getQueueEntryWithEvents = async (id: string) => {
  const queueEntry = await db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.id, id))
    .limit(1);

  if (queueEntry.length === 0) return null;

  const events = await db
    .select()
    .from(emailEvent)
    .where(eq(emailEvent.queueId, id))
    .orderBy(emailEvent.timestamp);

  return {
    ...queueEntry[0],
    events,
  };
};
