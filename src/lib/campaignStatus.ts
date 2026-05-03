export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'paused'

export type CampaignStatusBadge = {
  label: string
  tone: 'neutral' | 'info' | 'progress' | 'success' | 'warning'
}

const KNOWN: Record<CampaignStatus, CampaignStatusBadge> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  sending: { label: 'Sending', tone: 'progress' },
  completed: { label: 'Completed', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
}

export function describeCampaignStatus(
  status: string | null | undefined,
): CampaignStatusBadge {
  if (status && status in KNOWN) {
    return KNOWN[status as CampaignStatus]
  }
  return { label: status ? capitalize(status) : 'Unknown', tone: 'neutral' }
}

export function formatCampaignProgress(input: {
  totalRecipients: number
  sentCount: number
}): string {
  const total = Math.max(0, input.totalRecipients)
  const sent = clamp(input.sentCount, 0, total)
  if (total === 0) return '0 / 0'
  const pct = Math.round((sent / total) * 100)
  return `${sent} / ${total} (${pct}%)`
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}
