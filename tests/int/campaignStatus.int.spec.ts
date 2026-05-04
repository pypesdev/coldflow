import { describe, expect, it } from 'vitest'
import {
  describeCampaignStatus,
  formatCampaignProgress,
} from '@/lib/campaignStatus'

describe('describeCampaignStatus', () => {
  it.each([
    ['draft', { label: 'Draft', tone: 'neutral' }],
    ['scheduled', { label: 'Scheduled', tone: 'info' }],
    ['sending', { label: 'Sending', tone: 'progress' }],
    ['completed', { label: 'Completed', tone: 'success' }],
    ['paused', { label: 'Paused', tone: 'warning' }],
  ] as const)('maps known %s status', (input, expected) => {
    expect(describeCampaignStatus(input)).toEqual(expected)
  })

  it('falls back to capitalized neutral for unknown status', () => {
    expect(describeCampaignStatus('archived')).toEqual({
      label: 'Archived',
      tone: 'neutral',
    })
  })

  it('handles null and undefined', () => {
    expect(describeCampaignStatus(null)).toEqual({
      label: 'Unknown',
      tone: 'neutral',
    })
    expect(describeCampaignStatus(undefined)).toEqual({
      label: 'Unknown',
      tone: 'neutral',
    })
  })

  it('handles empty string as Unknown', () => {
    expect(describeCampaignStatus('')).toEqual({
      label: 'Unknown',
      tone: 'neutral',
    })
  })
})

describe('formatCampaignProgress', () => {
  it('formats with percentage', () => {
    expect(
      formatCampaignProgress({ totalRecipients: 100, sentCount: 25 }),
    ).toBe('25 / 100 (25%)')
  })

  it('returns 0 / 0 when total is zero', () => {
    expect(
      formatCampaignProgress({ totalRecipients: 0, sentCount: 0 }),
    ).toBe('0 / 0')
  })

  it('clamps sent above total back to total (no >100% display)', () => {
    expect(
      formatCampaignProgress({ totalRecipients: 10, sentCount: 25 }),
    ).toBe('10 / 10 (100%)')
  })

  it('clamps negative sent count to zero', () => {
    expect(
      formatCampaignProgress({ totalRecipients: 10, sentCount: -3 }),
    ).toBe('0 / 10 (0%)')
  })

  it('treats negative total as zero', () => {
    expect(
      formatCampaignProgress({ totalRecipients: -5, sentCount: 1 }),
    ).toBe('0 / 0')
  })

  it('rounds percentage to nearest integer', () => {
    expect(
      formatCampaignProgress({ totalRecipients: 3, sentCount: 1 }),
    ).toBe('1 / 3 (33%)')
    expect(
      formatCampaignProgress({ totalRecipients: 3, sentCount: 2 }),
    ).toBe('2 / 3 (67%)')
  })

  it('handles NaN sent count as zero', () => {
    expect(
      formatCampaignProgress({ totalRecipients: 10, sentCount: NaN }),
    ).toBe('0 / 10 (0%)')
  })
})
