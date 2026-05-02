import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../client";
import {
  emailQueue,
  emailEvent,
  replyFollowup,
  ReplyFollowup,
  InsertReplyFollowup,
} from "../schema";

export const createReplyFollowup = async (
  data: InsertReplyFollowup
): Promise<ReplyFollowup> => {
  const results = await db.insert(replyFollowup).values(data).returning();
  return results[0];
};

export const getReplyFollowupById = async (
  id: string
): Promise<ReplyFollowup | null> => {
  const results = await db
    .select()
    .from(replyFollowup)
    .where(eq(replyFollowup.id, id))
    .limit(1);
  return results[0] || null;
};

export const getScheduledFollowupsForContact = async (
  contactId: string
): Promise<ReplyFollowup[]> => {
  return await db
    .select()
    .from(replyFollowup)
    .where(
      and(
        eq(replyFollowup.contactId, contactId),
        eq(replyFollowup.status, "scheduled")
      )
    );
};

export const cancelScheduledFollowupsForContact = async (
  contactId: string,
  reason: string
): Promise<number> => {
  const results = await db
    .update(replyFollowup)
    .set({ status: "cancelled", cancelReason: reason, updatedAt: new Date() })
    .where(
      and(
        eq(replyFollowup.contactId, contactId),
        eq(replyFollowup.status, "scheduled")
      )
    )
    .returning({ id: replyFollowup.id });
  return results.length;
};

export const cancelReplyFollowup = async (
  id: string,
  reason: string
): Promise<ReplyFollowup | null> => {
  const results = await db
    .update(replyFollowup)
    .set({ status: "cancelled", cancelReason: reason, updatedAt: new Date() })
    .where(
      and(eq(replyFollowup.id, id), eq(replyFollowup.status, "scheduled"))
    )
    .returning();
  return results[0] || null;
};

export const markReplyFollowupSent = async (
  id: string,
  sentQueueId: string
): Promise<ReplyFollowup | null> => {
  const results = await db
    .update(replyFollowup)
    .set({
      status: "sent",
      sentQueueId,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(replyFollowup.id, id))
    .returning();
  return results[0] || null;
};

export const getDueScheduledFollowups = async (
  limit: number = 50,
  now: Date = new Date()
): Promise<ReplyFollowup[]> => {
  return await db
    .select()
    .from(replyFollowup)
    .where(
      and(
        eq(replyFollowup.status, "scheduled"),
        lte(replyFollowup.scheduledSendAt, now)
      )
    )
    .orderBy(replyFollowup.scheduledSendAt)
    .limit(limit);
};

export const countPendingFollowupsForCampaigns = async (
  campaignIds: string[]
): Promise<number> => {
  if (campaignIds.length === 0) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(replyFollowup)
    .where(
      and(
        eq(replyFollowup.status, "scheduled"),
        sql`${replyFollowup.sequenceId} = ANY(${campaignIds})`
      )
    );
  return result[0]?.count || 0;
};

export const listPendingFollowupsForCampaigns = async (
  campaignIds: string[],
  limit: number = 100
): Promise<ReplyFollowup[]> => {
  if (campaignIds.length === 0) return [];
  return await db
    .select()
    .from(replyFollowup)
    .where(
      and(
        eq(replyFollowup.status, "scheduled"),
        sql`${replyFollowup.sequenceId} = ANY(${campaignIds})`
      )
    )
    .orderBy(replyFollowup.scheduledSendAt)
    .limit(limit);
};

/**
 * Returns true if there is a `replied` email_event for this contact (queue id)
 * with a timestamp strictly after `since`. Used by the worker to cancel a
 * scheduled follow-up when the prospect has replied again since the row was
 * created.
 */
export const hasReplyAfter = async (
  contactQueueId: string,
  since: Date
): Promise<boolean> => {
  const results = await db
    .select({ id: emailEvent.id })
    .from(emailEvent)
    .where(
      and(
        eq(emailEvent.queueId, contactQueueId),
        eq(emailEvent.eventType, "replied"),
        sql`${emailEvent.timestamp} > ${since}`
      )
    )
    .limit(1);
  return results.length > 0;
};

export const getOriginalQueueEntry = async (queueId: string) => {
  const results = await db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.id, queueId))
    .limit(1);
  return results[0] || null;
};
