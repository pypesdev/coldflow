import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('nanoid', () => ({
  nanoid: () => `id-${Math.random().toString(36).slice(2)}`,
}))

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    cancelScheduledFollowupsForContact: vi.fn(),
    createEmailEvent: vi.fn(),
    createQueueEntry: vi.fn(),
    createReplyFollowup: vi.fn(),
    eventExistsForTracking: vi.fn(),
    getDueScheduledFollowups: vi.fn(),
    getOriginalQueueEntry: vi.fn(),
    hasReplyAfter: vi.fn(),
    incrementCampaignStat: vi.fn(),
    markReplyFollowupSent: vi.fn(),
    cancelReplyFollowup: vi.fn(),
  },
}))

vi.mock('@coldflow/db', () => dbMock)

import {
  getFollowupOffsetMs,
  processDueReplyFollowups,
  recordInboundReply,
  replyMatchesFollowupHeuristic,
} from '@/lib/replyFollowup'

beforeEach(() => {
  for (const fn of Object.values(dbMock)) {
    fn.mockReset()
  }
  delete process.env.REPLY_FOLLOWUP_OFFSET_DAYS
})

describe('replyMatchesFollowupHeuristic', () => {
  it('matches replies with a question mark', () => {
    expect(replyMatchesFollowupHeuristic('Sounds great. Got time tomorrow?')).toBe(true)
  })

  it('matches pricing/cost/details/more info keywords case-insensitively', () => {
    expect(replyMatchesFollowupHeuristic('Send pricing')).toBe(true)
    expect(replyMatchesFollowupHeuristic('what does it COST')).toBe(true)
    expect(replyMatchesFollowupHeuristic('Yes please send Details')).toBe(true)
    expect(replyMatchesFollowupHeuristic('need more info before deciding')).toBe(true)
    expect(replyMatchesFollowupHeuristic('What is the price for 50 seats')).toBe(true)
  })

  it('does not match replies without cues', () => {
    expect(replyMatchesFollowupHeuristic('thanks but not interested.')).toBe(false)
    expect(replyMatchesFollowupHeuristic('please remove me from this list.')).toBe(false)
    expect(replyMatchesFollowupHeuristic('')).toBe(false)
  })
})

describe('getFollowupOffsetMs', () => {
  it('defaults to 3 days', () => {
    expect(getFollowupOffsetMs()).toBe(3 * 24 * 60 * 60 * 1000)
  })

  it('honours REPLY_FOLLOWUP_OFFSET_DAYS env var', () => {
    process.env.REPLY_FOLLOWUP_OFFSET_DAYS = '5'
    expect(getFollowupOffsetMs()).toBe(5 * 24 * 60 * 60 * 1000)
  })

  it('falls back to default for non-positive or invalid values', () => {
    process.env.REPLY_FOLLOWUP_OFFSET_DAYS = '-2'
    expect(getFollowupOffsetMs()).toBe(3 * 24 * 60 * 60 * 1000)
    process.env.REPLY_FOLLOWUP_OFFSET_DAYS = 'banana'
    expect(getFollowupOffsetMs()).toBe(3 * 24 * 60 * 60 * 1000)
  })
})

describe('recordInboundReply', () => {
  const queueEntry = {
    id: 'queue-1',
    campaignId: 'campaign-1',
    trackingId: 'track-1',
    recipientEmail: 'prospect@example.com',
    recipientName: 'Pat',
    subject: 'Quick question',
  }

  it('writes a replied event, increments campaign reply count, and schedules a followup when heuristic matches', async () => {
    dbMock.getOriginalQueueEntry.mockResolvedValueOnce(queueEntry)
    dbMock.eventExistsForTracking.mockResolvedValueOnce(false)
    dbMock.cancelScheduledFollowupsForContact.mockResolvedValueOnce(0)
    dbMock.createReplyFollowup.mockResolvedValueOnce({
      id: 'followup-1',
      sequenceId: 'campaign-1',
      contactId: 'queue-1',
      status: 'scheduled',
    })

    const replyAt = new Date('2026-05-01T10:00:00Z')
    const result = await recordInboundReply({
      contactQueueId: 'queue-1',
      replyBody: 'Could you share pricing?',
      replyAt,
    })

    expect(result.followupCreated).toBe(true)
    expect(dbMock.createEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        queueId: 'queue-1',
        trackingId: 'track-1',
        eventType: 'replied',
        timestamp: replyAt,
      })
    )
    expect(dbMock.incrementCampaignStat).toHaveBeenCalledWith('campaign-1', 'replyCount')
    expect(dbMock.cancelScheduledFollowupsForContact).toHaveBeenCalledWith(
      'queue-1',
      'superseded_by_new_reply'
    )
    const insert = dbMock.createReplyFollowup.mock.calls[0][0]
    expect(insert).toMatchObject({
      sequenceId: 'campaign-1',
      contactId: 'queue-1',
      recipientEmail: 'prospect@example.com',
      lastReplyAt: replyAt,
      status: 'scheduled',
    })
    const expectedSendAt = new Date(replyAt.getTime() + 3 * 24 * 60 * 60 * 1000)
    expect((insert.scheduledSendAt as Date).getTime()).toBe(expectedSendAt.getTime())
  })

  it('does not create a followup when the heuristic does not match (but still records the reply)', async () => {
    dbMock.getOriginalQueueEntry.mockResolvedValueOnce(queueEntry)
    dbMock.eventExistsForTracking.mockResolvedValueOnce(false)
    dbMock.cancelScheduledFollowupsForContact.mockResolvedValueOnce(0)

    const result = await recordInboundReply({
      contactQueueId: 'queue-1',
      replyBody: 'thanks but not a fit right now',
    })

    expect(result.followupCreated).toBe(false)
    expect(result.reason).toBe('heuristic_no_match')
    expect(dbMock.createReplyFollowup).not.toHaveBeenCalled()
    expect(dbMock.createEmailEvent).toHaveBeenCalled()
  })

  it('cancels existing scheduled followups when a new reply arrives (cancel-on-new-reply rule)', async () => {
    dbMock.getOriginalQueueEntry.mockResolvedValueOnce(queueEntry)
    dbMock.eventExistsForTracking.mockResolvedValueOnce(true)
    dbMock.cancelScheduledFollowupsForContact.mockResolvedValueOnce(1)
    dbMock.createReplyFollowup.mockResolvedValueOnce({
      id: 'followup-2',
      sequenceId: 'campaign-1',
      contactId: 'queue-1',
      status: 'scheduled',
    })

    const result = await recordInboundReply({
      contactQueueId: 'queue-1',
      replyBody: 'Actually, can you clarify pricing once more?',
    })

    expect(dbMock.cancelScheduledFollowupsForContact).toHaveBeenCalledWith(
      'queue-1',
      'superseded_by_new_reply'
    )
    expect(result.cancelledExistingCount).toBe(1)
    // duplicate reply event suppressed
    expect(dbMock.createEmailEvent).not.toHaveBeenCalled()
    expect(dbMock.incrementCampaignStat).not.toHaveBeenCalled()
    // new heuristic-matching reply still schedules a fresh follow-up
    expect(dbMock.createReplyFollowup).toHaveBeenCalledTimes(1)
    expect(result.followupCreated).toBe(true)
  })

  it('returns no_queue_entry when the original outbound row cannot be found', async () => {
    dbMock.getOriginalQueueEntry.mockResolvedValueOnce(null)
    const result = await recordInboundReply({
      contactQueueId: 'missing',
      replyBody: 'price?',
    })
    expect(result).toEqual({
      followupCreated: false,
      cancelledExistingCount: 0,
      reason: 'no_queue_entry',
    })
    expect(dbMock.createEmailEvent).not.toHaveBeenCalled()
    expect(dbMock.createReplyFollowup).not.toHaveBeenCalled()
  })
})

describe('processDueReplyFollowups', () => {
  const dueRow = {
    id: 'followup-1',
    sequenceId: 'campaign-1',
    contactId: 'queue-1',
    recipientEmail: 'prospect@example.com',
    lastReplyAt: new Date('2026-04-25T09:00:00Z'),
    lastReplyExcerpt: 'price?',
    scheduledSendAt: new Date('2026-04-28T09:00:00Z'),
    status: 'scheduled' as const,
  }

  it('cancels the row when the prospect has replied again since lastReplyAt', async () => {
    dbMock.getDueScheduledFollowups.mockResolvedValueOnce([dueRow])
    dbMock.hasReplyAfter.mockResolvedValueOnce(true)
    dbMock.cancelReplyFollowup.mockResolvedValueOnce({ ...dueRow, status: 'cancelled' })

    const result = await processDueReplyFollowups(10, new Date('2026-04-28T10:00:00Z'))

    expect(result.cancelled).toBe(1)
    expect(result.enqueued).toBe(0)
    expect(dbMock.cancelReplyFollowup).toHaveBeenCalledWith(
      'followup-1',
      'new_reply_received'
    )
    expect(dbMock.createQueueEntry).not.toHaveBeenCalled()
    expect(dbMock.markReplyFollowupSent).not.toHaveBeenCalled()
  })

  it('enqueues a silent-reply email and marks the row sent when no new reply', async () => {
    dbMock.getDueScheduledFollowups.mockResolvedValueOnce([dueRow])
    dbMock.hasReplyAfter.mockResolvedValueOnce(false)
    dbMock.getOriginalQueueEntry.mockResolvedValueOnce({
      id: 'queue-1',
      campaignId: 'campaign-1',
      emailAccountId: 'account-1',
      recipientEmail: 'prospect@example.com',
      recipientName: 'Pat Example',
      subject: 'Quick question',
      trackingId: 'track-1',
    })
    dbMock.createQueueEntry.mockResolvedValueOnce({ id: 'queue-2' })
    dbMock.markReplyFollowupSent.mockResolvedValueOnce({ ...dueRow, status: 'sent' })

    const result = await processDueReplyFollowups(10, new Date('2026-04-28T10:00:00Z'))

    expect(result.enqueued).toBe(1)
    expect(result.cancelled).toBe(0)
    expect(dbMock.createQueueEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
        emailAccountId: 'account-1',
        recipientEmail: 'prospect@example.com',
        subject: 'Re: Quick question',
        status: 'pending',
      })
    )
    expect(dbMock.markReplyFollowupSent).toHaveBeenCalledWith('followup-1', 'queue-2')
  })

  it('returns early when nothing is due', async () => {
    dbMock.getDueScheduledFollowups.mockResolvedValueOnce([])
    const result = await processDueReplyFollowups()
    expect(result).toEqual({
      due: 0,
      enqueued: 0,
      cancelled: 0,
      skipped: 0,
      errors: [],
    })
  })
})
