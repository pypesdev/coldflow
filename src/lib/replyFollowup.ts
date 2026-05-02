import { nanoid } from "nanoid";
import {
  cancelScheduledFollowupsForContact,
  createEmailEvent,
  createQueueEntry,
  createReplyFollowup,
  eventExistsForTracking,
  getDueScheduledFollowups,
  getOriginalQueueEntry,
  hasReplyAfter,
  incrementCampaignStat,
  markReplyFollowupSent,
  cancelReplyFollowup,
  ReplyFollowup,
} from "@coldflow/db";

/**
 * Default offset (in days) between an inbound reply and the silent-reply
 * follow-up. Tunable via env so prod can dial it without a deploy.
 */
const DEFAULT_OFFSET_DAYS = 3;

export const getFollowupOffsetMs = (): number => {
  const raw = process.env.REPLY_FOLLOWUP_OFFSET_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OFFSET_DAYS;
  return Math.round(days * 24 * 60 * 60 * 1000);
};

/**
 * Keyword heuristic for v1. Matches if the reply contains any pricing/details
 * cue or a question mark. Intentionally dumb — easy to swap for an LLM call.
 */
const HEURISTIC_KEYWORDS = ["pricing", "price", "cost", "details", "more info"];

export const replyMatchesFollowupHeuristic = (replyBody: string): boolean => {
  if (!replyBody) return false;
  const normalized = replyBody.toLowerCase();
  if (normalized.includes("?")) return true;
  return HEURISTIC_KEYWORDS.some((kw) => normalized.includes(kw));
};

const EXCERPT_MAX_LENGTH = 280;

const buildExcerpt = (body: string): string => {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed.length <= EXCERPT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, EXCERPT_MAX_LENGTH - 1)}…`;
};

export interface RecordInboundReplyInput {
  /** id of the original outbound email_queue row this reply is responding to */
  contactQueueId: string;
  /** plain-text body (or best-effort plaintext) of the inbound reply */
  replyBody: string;
  /** when the reply landed; defaults to now */
  replyAt?: Date;
}

export interface RecordInboundReplyResult {
  followupCreated: boolean;
  followup?: ReplyFollowup;
  cancelledExistingCount: number;
  reason?: "no_queue_entry" | "heuristic_no_match";
}

/**
 * Canonical entry point for inbound replies. Writes the `replied` event
 * (idempotent on tracking_id), bumps the campaign reply count, cancels any
 * still-scheduled follow-up for this contact (the new reply supersedes it),
 * and — when the heuristic matches — schedules a silent-reply follow-up.
 *
 * Designed to be reused by whichever pipe ends up detecting replies (Gmail
 * watch webhook, IMAP poller, etc.). Keeping the logic here means we only
 * have one place that owns the dashboard 'replied' metric and the follow-up
 * trigger.
 */
export const recordInboundReply = async (
  input: RecordInboundReplyInput
): Promise<RecordInboundReplyResult> => {
  const replyAt = input.replyAt ?? new Date();
  const queueEntry = await getOriginalQueueEntry(input.contactQueueId);

  if (!queueEntry) {
    return { followupCreated: false, cancelledExistingCount: 0, reason: "no_queue_entry" };
  }

  const alreadyReplied = await eventExistsForTracking(queueEntry.trackingId, "replied");
  if (!alreadyReplied) {
    await createEmailEvent({
      id: nanoid(),
      queueId: queueEntry.id,
      trackingId: queueEntry.trackingId,
      eventType: "replied",
      timestamp: replyAt,
      metadata: { excerpt: buildExcerpt(input.replyBody) },
    });
    await incrementCampaignStat(queueEntry.campaignId, "replyCount");
  }

  const cancelledExistingCount = await cancelScheduledFollowupsForContact(
    queueEntry.id,
    "superseded_by_new_reply"
  );

  if (!replyMatchesFollowupHeuristic(input.replyBody)) {
    return {
      followupCreated: false,
      cancelledExistingCount,
      reason: "heuristic_no_match",
    };
  }

  const followup = await createReplyFollowup({
    id: nanoid(),
    sequenceId: queueEntry.campaignId,
    contactId: queueEntry.id,
    recipientEmail: queueEntry.recipientEmail,
    lastReplyAt: replyAt,
    lastReplyExcerpt: buildExcerpt(input.replyBody),
    scheduledSendAt: new Date(replyAt.getTime() + getFollowupOffsetMs()),
    status: "scheduled",
  });

  return { followupCreated: true, followup, cancelledExistingCount };
};

const SILENT_FOLLOWUP_SUBJECT_PREFIX = "Re: ";
const SILENT_FOLLOWUP_BODY = (recipientName?: string | null) => {
  const greeting = recipientName ? `Hi ${recipientName.split(" ")[0]},` : "Hi,";
  return [
    greeting,
    "",
    "Just bumping this up — wanted to make sure my last note didn't get buried.",
    "Happy to send over the details / pricing whenever it's useful, or jump on a quick call if that's easier.",
    "",
    "Thanks!",
  ].join("\n");
};

export interface ProcessFollowupsResult {
  due: number;
  enqueued: number;
  cancelled: number;
  skipped: number;
  errors: string[];
}

/**
 * Process scheduled follow-ups whose send time has arrived. For each row:
 *   - if the prospect has replied again since `last_reply_at` → mark cancelled
 *   - else enqueue a short silent-reply follow-up email and mark the row sent
 *
 * Returns a summary suitable for cron logging / API response.
 */
export const processDueReplyFollowups = async (
  limit: number = 50,
  now: Date = new Date()
): Promise<ProcessFollowupsResult> => {
  const result: ProcessFollowupsResult = {
    due: 0,
    enqueued: 0,
    cancelled: 0,
    skipped: 0,
    errors: [],
  };

  const due = await getDueScheduledFollowups(limit, now);
  result.due = due.length;
  if (due.length === 0) return result;

  for (const row of due) {
    try {
      const replied = await hasReplyAfter(row.contactId, row.lastReplyAt);
      if (replied) {
        await cancelReplyFollowup(row.id, "new_reply_received");
        result.cancelled++;
        continue;
      }

      const original = await getOriginalQueueEntry(row.contactId);
      if (!original) {
        await cancelReplyFollowup(row.id, "original_queue_missing");
        result.skipped++;
        continue;
      }

      const subject = original.subject.startsWith(SILENT_FOLLOWUP_SUBJECT_PREFIX)
        ? original.subject
        : `${SILENT_FOLLOWUP_SUBJECT_PREFIX}${original.subject}`;
      const bodyText = SILENT_FOLLOWUP_BODY(original.recipientName);

      const queueEntry = await createQueueEntry({
        id: nanoid(),
        campaignId: original.campaignId,
        emailAccountId: original.emailAccountId,
        recipientEmail: original.recipientEmail,
        recipientName: original.recipientName,
        subject,
        bodyText,
        bodyHtml: null,
        scheduledFor: now,
        status: "pending",
        trackingId: nanoid(),
      });

      await markReplyFollowupSent(row.id, queueEntry.id);
      result.enqueued++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      result.errors.push(`${row.id}: ${message}`);
    }
  }

  return result;
};
