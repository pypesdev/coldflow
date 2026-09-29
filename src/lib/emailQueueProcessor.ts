import {
  getNextPendingEmails,
  updateQueueStatus,
  rescheduleQueueEntry,
  incrementAttemptCount,
  createEmailEvent,
  incrementCampaignStat,
  getEmailAccountById,
  isEmailUnsubscribed,
} from '@coldflow/db';
import { sendEmail, hasAvailableQuota } from './gmailService';
import { computeQuotaRescheduleAt } from './queueScheduling';
import { nanoid } from 'nanoid';

/**
 * Email Queue Processor
 *
 * Processes pending emails from the queue and sends them via Gmail API.
 * Handles quota limits, retries, and event tracking.
 */

interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Process a batch of pending emails from the queue
 *
 * @param batchSize - Number of emails to process in this batch (default: 10)
 * @returns Summary of processing results
 */
export async function processEmailQueue(batchSize: number = 10): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Fetch next pending emails (with row-level locking to prevent concurrent processing)
    const pendingEmails = await getNextPendingEmails(batchSize);

    if (pendingEmails.length === 0) {
      console.log('No pending emails to process');
      return result;
    }

    console.log(`Processing ${pendingEmails.length} pending emails`);

    // Process each email
    for (const queueEntry of pendingEmails) {
      result.processed++;

      try {
        // Check if recipient has unsubscribed
        const unsubscribed = await isEmailUnsubscribed(queueEntry.recipientEmail);
        if (unsubscribed) {
          await updateQueueStatus(
            queueEntry.id,
            'failed',
            null,
            'Recipient has unsubscribed'
          );
          result.skipped++;
          console.log(`Skipped unsubscribed recipient: ${queueEntry.recipientEmail}`);
          continue;
        }

        // Check if scheduled time has passed
        const now = new Date();
        const scheduledFor = new Date(queueEntry.scheduledFor);
        if (scheduledFor > now) {
          // Not yet time to send - skip for now
          result.skipped++;
          console.log(`Email ${queueEntry.id} not yet scheduled (scheduled for ${scheduledFor})`);
          continue;
        }

        // Check if email account has available quota
        const hasQuota = await hasAvailableQuota(queueEntry.emailAccountId);
        if (!hasQuota) {
          const account = await getEmailAccountById(queueEntry.emailAccountId);
          const quotaResetAt = account?.quotaResetAt
            ? new Date(account.quotaResetAt)
            : null;

          // Always push the entry's `scheduledFor` forward — without that,
          // `getNextPendingEmails` (which filters `scheduledFor <= now`)
          // would re-pick this entry on every batch and we'd spin.
          const nextAttempt = computeQuotaRescheduleAt(quotaResetAt, now);
          await rescheduleQueueEntry(
            queueEntry.id,
            nextAttempt,
            'Quota exceeded - rescheduled'
          );
          result.skipped++;
          console.log(
            `Email ${queueEntry.id} skipped - quota exceeded, rescheduled for ${nextAttempt.toISOString()}`
          );
          continue;
        }

        // Update status to processing
        await updateQueueStatus(queueEntry.id, 'processing');

        // Send the email
        const sendResult = await sendEmail(queueEntry.emailAccountId, {
          to: queueEntry.recipientEmail,
          toName: queueEntry.recipientName || undefined,
          subject: queueEntry.subject,
          bodyHtml: queueEntry.bodyHtml || undefined,
          bodyText: queueEntry.bodyText || '',
          trackingId: queueEntry.trackingId,
        });

        if (sendResult.success) {
          // Email sent successfully
          await updateQueueStatus(
            queueEntry.id,
            'sent',
            new Date(),
            null
          );

          // Create sent event
          await createEmailEvent({
            id: nanoid(),
            queueId: queueEntry.id,
            trackingId: queueEntry.trackingId,
            eventType: 'sent',
            timestamp: new Date(),
            metadata: {
              messageId: sendResult.messageId,
            },
          });

          // Increment campaign sent count
          await incrementCampaignStat(queueEntry.campaignId, 'sentCount');

          result.sent++;
          console.log(`Email ${queueEntry.id} sent successfully to ${queueEntry.recipientEmail}`);
        } else {
          // Email failed to send
          await incrementAttemptCount(queueEntry.id);

          // Check if max attempts reached
          if (queueEntry.attemptCount + 1 >= queueEntry.maxAttempts) {
            await updateQueueStatus(
              queueEntry.id,
              'failed',
              null,
              sendResult.error || 'Max attempts reached'
            );
            result.failed++;
            console.error(`Email ${queueEntry.id} permanently failed: ${sendResult.error}`);
          } else {
            // Will retry later
            await updateQueueStatus(
              queueEntry.id,
              'pending',
              null,
              sendResult.error || 'Temporary failure'
            );
            result.failed++;
            console.error(`Email ${queueEntry.id} failed (attempt ${queueEntry.attemptCount + 1}/${queueEntry.maxAttempts}): ${sendResult.error}`);
          }

          result.errors.push(`${queueEntry.id}: ${sendResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        // Unexpected error processing this email
        console.error(`Error processing email ${queueEntry.id}:`, error);

        await incrementAttemptCount(queueEntry.id);

        if (queueEntry.attemptCount + 1 >= queueEntry.maxAttempts) {
          await updateQueueStatus(
            queueEntry.id,
            'failed',
            null,
            error instanceof Error ? error.message : 'Unknown error'
          );
        } else {
          await updateQueueStatus(
            queueEntry.id,
            'pending',
            null,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }

        result.failed++;
        result.errors.push(`${queueEntry.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('Queue processing summary:', {
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      errorCount: result.errors.length,
    });

    return result;
  } catch (error) {
    console.error('Fatal error in email queue processor:', error);
    throw error;
  }
}

/**
 * Get the next scheduled processing time based on pending emails
 * Useful for scheduling cron jobs efficiently
 */
export async function getNextProcessingTime(): Promise<Date | null> {
  const nextEmails = await getNextPendingEmails(1);

  if (nextEmails.length === 0) {
    return null;
  }

  return new Date(nextEmails[0].scheduledFor);
}
