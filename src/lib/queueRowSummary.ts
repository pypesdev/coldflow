export type QueueStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'bounced'

export type QueueStatusBadge = {
  label: string
  tone: 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'error'
}

const KNOWN: Record<QueueStatus, QueueStatusBadge> = {
  pending: { label: 'Pending', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'progress' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
  bounced: { label: 'Bounced', tone: 'warning' },
}

export function describeQueueStatus(
  status: string | null | undefined,
): QueueStatusBadge {
  if (status && status in KNOWN) {
    return KNOWN[status as QueueStatus]
  }
  return { label: status ? capitalize(status) : 'Unknown', tone: 'neutral' }
}

/**
 * Trim verbose Gmail / SMTP / OAuth error blobs to a single useful line.
 * Caller-provided errors are surfaced in the UI table; long stack traces or
 * full HTTP bodies make the row unreadable. Always returns a string ≤ max.
 */
export function summarizeError(
  raw: string | null | undefined,
  max = 140,
): string {
  if (!raw) return ''
  const firstLine = raw.split(/\r?\n/, 1)[0]?.trim() ?? ''
  if (firstLine.length <= max) return firstLine
  return firstLine.slice(0, max - 1).trimEnd() + '…'
}

/**
 * Format a duration between `from` and `to` (defaults to now) as a short,
 * UI-friendly relative string ("2m ago", "in 3h", "just now"). Pure;
 * tests pass a fixed `now` so no system-clock dependency.
 */
export function formatRelativeTime(
  from: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  if (!from) return ''
  const ts = typeof from === 'string' ? new Date(from) : from
  if (Number.isNaN(ts.getTime())) return ''

  const diffMs = ts.getTime() - now.getTime()
  const past = diffMs < 0
  const abs = Math.abs(diffMs)

  if (abs < 45_000) return 'just now'

  const units: Array<[number, string]> = [
    [60_000, 'm'],
    [3_600_000, 'h'],
    [86_400_000, 'd'],
    [604_800_000, 'w'],
  ]

  let value = 0
  let suffix = ''
  for (let i = 0; i < units.length; i++) {
    const [scale, label] = units[i]
    const next = units[i + 1]?.[0]
    if (!next || abs < next) {
      value = Math.round(abs / scale)
      suffix = label
      break
    }
  }
  if (!suffix) {
    value = Math.round(abs / 604_800_000)
    suffix = 'w'
  }
  return past ? `${value}${suffix} ago` : `in ${value}${suffix}`
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}
