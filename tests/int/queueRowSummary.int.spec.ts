import { describe, expect, it } from 'vitest'
import {
  describeQueueStatus,
  formatRelativeTime,
  summarizeError,
} from '@/lib/queueRowSummary'

describe('describeQueueStatus', () => {
  it.each([
    ['pending', 'Pending', 'neutral'],
    ['processing', 'Processing', 'progress'],
    ['sent', 'Sent', 'success'],
    ['failed', 'Failed', 'error'],
    ['bounced', 'Bounced', 'warning'],
  ])('maps %s to %s/%s', (input, label, tone) => {
    expect(describeQueueStatus(input)).toEqual({ label, tone })
  })

  it('falls back to capitalized neutral for unknown', () => {
    expect(describeQueueStatus('archived')).toEqual({
      label: 'Archived',
      tone: 'neutral',
    })
  })

  it('handles null / undefined / empty', () => {
    expect(describeQueueStatus(null).label).toBe('Unknown')
    expect(describeQueueStatus(undefined).label).toBe('Unknown')
    expect(describeQueueStatus('').label).toBe('Unknown')
  })
})

describe('summarizeError', () => {
  it('returns empty string for empty input', () => {
    expect(summarizeError(null)).toBe('')
    expect(summarizeError(undefined)).toBe('')
    expect(summarizeError('')).toBe('')
  })

  it('returns the first line, trimmed', () => {
    expect(summarizeError('  oh no  \nstack trace\nmore\n')).toBe('oh no')
  })

  it('truncates with ellipsis when over the max', () => {
    const long = 'x'.repeat(200)
    const out = summarizeError(long, 50)
    expect(out).toHaveLength(50)
    expect(out.endsWith('…')).toBe(true)
  })

  it('honors a custom max length', () => {
    expect(summarizeError('hello world', 5)).toBe('hell…')
  })

  it('handles CRLF line endings', () => {
    expect(summarizeError('first\r\nsecond')).toBe('first')
  })

  it('keeps lines exactly at the max as-is (no ellipsis)', () => {
    const exact = 'a'.repeat(140)
    expect(summarizeError(exact)).toBe(exact)
  })

  it('trims trailing whitespace before adding the ellipsis', () => {
    const out = summarizeError('hello       world world', 10)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/ +…$/)
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-03T12:00:00Z')

  it.each([
    [new Date('2026-05-03T12:00:00Z'), 'just now'],
    [new Date('2026-05-03T11:59:50Z'), 'just now'],
    [new Date('2026-05-03T11:58:00Z'), '2m ago'],
    [new Date('2026-05-03T11:00:00Z'), '1h ago'],
    [new Date('2026-05-03T09:00:00Z'), '3h ago'],
    [new Date('2026-05-02T12:00:00Z'), '1d ago'],
    [new Date('2026-04-26T12:00:00Z'), '1w ago'],
    [new Date('2026-04-01T12:00:00Z'), '5w ago'],
  ])('past: %s -> %s', (from, expected) => {
    expect(formatRelativeTime(from, now)).toBe(expected)
  })

  it.each([
    [new Date('2026-05-03T12:02:00Z'), 'in 2m'],
    [new Date('2026-05-03T13:00:00Z'), 'in 1h'],
    [new Date('2026-05-04T12:00:00Z'), 'in 1d'],
    [new Date('2026-05-10T12:00:00Z'), 'in 1w'],
  ])('future: %s -> %s', (from, expected) => {
    expect(formatRelativeTime(from, now)).toBe(expected)
  })

  it('accepts ISO string input', () => {
    expect(formatRelativeTime('2026-05-03T11:00:00Z', now)).toBe('1h ago')
  })

  it('returns empty for null / undefined / NaN dates', () => {
    expect(formatRelativeTime(null, now)).toBe('')
    expect(formatRelativeTime(undefined, now)).toBe('')
    expect(formatRelativeTime('not-a-date', now)).toBe('')
  })

  it('rounds to the nearest unit (not floor)', () => {
    // 89s ago rounds to 1m, 91s ago also rounds to 2m (closer)
    expect(
      formatRelativeTime(new Date(now.getTime() - 89_000), now),
    ).toBe('1m ago')
    expect(
      formatRelativeTime(new Date(now.getTime() - 91_000), now),
    ).toBe('2m ago')
  })
})
