import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  reply,
  Reply,
  InsertReply,
  ReplyIntent,
  ReplyTriageStatus,
} from "../schema";

export const createReply = async (data: InsertReply): Promise<Reply> => {
  const results = await db.insert(reply).values(data).returning();
  return results[0];
};

export const getReplyById = async (id: string): Promise<Reply | null> => {
  const results = await db.select().from(reply).where(eq(reply.id, id)).limit(1);
  return results[0] || null;
};

/**
 * Returns triaged replies for a set of campaigns, ordered newest-first.
 * Powers the `/dashboard/replies` UI tabs. Filters out archived rows by
 * default (they are still kept in the table for audit).
 */
export const listRepliesForCampaigns = async (
  campaignIds: string[],
  options?: {
    intent?: ReplyIntent;
    status?: ReplyTriageStatus;
    includeArchived?: boolean;
    limit?: number;
  }
): Promise<Reply[]> => {
  if (campaignIds.length === 0) return [];

  const conditions = [sql`${reply.campaignId} = ANY(${campaignIds})`];
  if (options?.intent) conditions.push(eq(reply.intent, options.intent));
  if (options?.status) conditions.push(eq(reply.status, options.status));
  else if (!options?.includeArchived) {
    conditions.push(sql`${reply.status} <> 'archived'`);
  }

  return await db
    .select()
    .from(reply)
    .where(and(...conditions))
    .orderBy(desc(reply.receivedAt))
    .limit(options?.limit ?? 200);
};

export const countRepliesByIntentForCampaigns = async (
  campaignIds: string[]
): Promise<Record<ReplyIntent, number>> => {
  const empty: Record<ReplyIntent, number> = {
    interested: 0,
    objection: 0,
    not_now: 0,
    out_of_office: 0,
  };
  if (campaignIds.length === 0) return empty;

  const rows = await db
    .select({ intent: reply.intent, count: sql<number>`count(*)::int` })
    .from(reply)
    .where(
      and(
        sql`${reply.campaignId} = ANY(${campaignIds})`,
        eq(reply.status, "new")
      )
    )
    .groupBy(reply.intent);

  for (const row of rows) {
    empty[row.intent] = row.count;
  }
  return empty;
};

export const updateReplySuggestedFollowup = async (
  id: string,
  suggestedFollowup: string
): Promise<Reply | null> => {
  const results = await db
    .update(reply)
    .set({ suggestedFollowup, updatedAt: new Date() })
    .where(eq(reply.id, id))
    .returning();
  return results[0] || null;
};

export const markReplyActioned = async (
  id: string,
  sentQueueId: string,
  now: Date = new Date()
): Promise<Reply | null> => {
  const results = await db
    .update(reply)
    .set({
      status: "actioned",
      sentQueueId,
      actionedAt: now,
      updatedAt: now,
    })
    .where(eq(reply.id, id))
    .returning();
  return results[0] || null;
};

export const markReplyArchived = async (
  id: string,
  now: Date = new Date()
): Promise<Reply | null> => {
  const results = await db
    .update(reply)
    .set({ status: "archived", archivedAt: now, updatedAt: now })
    .where(eq(reply.id, id))
    .returning();
  return results[0] || null;
};
