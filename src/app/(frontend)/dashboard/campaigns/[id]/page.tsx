'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  describeCampaignStatus,
  formatCampaignProgress,
} from '@/lib/campaignStatus'
import {
  describeQueueStatus,
  formatRelativeTime,
  summarizeError,
} from '@/lib/queueRowSummary'

type QueueEntry = {
  id: string
  recipientEmail: string
  recipientName: string | null
  status: string
  attemptCount: number
  maxAttempts: number
  scheduledFor: string | null
  lastAttemptAt: string | null
  sentAt: string | null
  errorMessage: string | null
}

type QueueState =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: QueueEntry[]; hasMore: boolean }
  | { kind: 'error'; message: string }

type CampaignDetail = {
  id: string
  name: string
  status: string
  totalRecipients: number
  sentCount: number
  openCount: number
  clickCount: number
  replyCount: number
  bounceCount: number
  unsubscribeCount: number
  createdAt: string
  updatedAt: string
  queueStats?: {
    pending?: number
    sent?: number
    failed?: number
    bounced?: number
  }
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; campaign: CampaignDetail }
  | { kind: 'error'; status?: number; message: string }

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [queue, setQueue] = useState<QueueState>({ kind: 'loading' })
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/campaigns/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.success) {
          const msg = data?.error || `Failed (${res.status})`
          throw Object.assign(new Error(msg), { status: res.status })
        }
        return data.campaign as CampaignDetail
      })
      .then((campaign) => {
        if (!cancelled) setState({ kind: 'ready', campaign })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          kind: 'error',
          status: err?.status,
          message: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/campaigns/${id}/queue?limit=100`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Failed (${res.status})`)
        }
        return {
          entries: data.entries as QueueEntry[],
          hasMore: Boolean(data.pagination?.hasMore),
        }
      })
      .then(({ entries, hasMore }) => {
        if (!cancelled) setQueue({ kind: 'ready', entries, hasMore })
      })
      .catch((err) => {
        if (cancelled) return
        setQueue({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const handleDelete = async () => {
    if (state.kind !== 'ready') return
    if (!confirm(`Delete "${state.campaign.name}" and all its queue entries?`)) {
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed (${res.status})`)
      }
      router.push('/dashboard/campaigns')
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-4 text-sm text-muted-foreground">
          <Link href="/dashboard/campaigns" className="underline">
            Campaigns
          </Link>{' '}
          / <span>{state.kind === 'ready' ? state.campaign.name : id}</span>
        </nav>

        {state.kind === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading campaign…</p>
        )}

        {state.kind === 'error' && (
          <div className="rounded border bg-red-50 p-4">
            <p className="text-sm text-red-600">{state.message}</p>
            {state.status === 404 && (
              <p className="text-sm text-muted-foreground mt-2">
                Campaign may have been deleted.{' '}
                <Link href="/dashboard/campaigns" className="underline">
                  Back to list
                </Link>
                .
              </p>
            )}
          </div>
        )}

        {state.kind === 'ready' && (
          <CampaignDetailBody
            campaign={state.campaign}
            queue={queue}
            deleting={deleting}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  )
}

function CampaignDetailBody({
  campaign,
  queue,
  deleting,
  onDelete,
}: {
  campaign: CampaignDetail
  queue: QueueState
  deleting: boolean
  onDelete: () => void
}) {
  const badge = describeCampaignStatus(campaign.status)
  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            Created {new Date(campaign.createdAt).toLocaleString()} · Updated{' '}
            {new Date(campaign.updatedAt).toLocaleString()}
          </p>
        </div>
        <span
          data-tone={badge.tone}
          className="text-xs px-2 py-0.5 rounded bg-muted self-start"
        >
          {badge.label}
        </span>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-medium mb-2">Send progress</h2>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCampaignProgress({
            totalRecipients: campaign.totalRecipients,
            sentCount: campaign.sentCount,
          })}
        </p>
      </section>

      <section className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat label="Opens" value={campaign.openCount} />
        <Stat label="Clicks" value={campaign.clickCount} />
        <Stat label="Replies" value={campaign.replyCount} />
        <Stat label="Bounces" value={campaign.bounceCount} />
        <Stat label="Unsubscribes" value={campaign.unsubscribeCount} />
        <Stat label="Total recipients" value={campaign.totalRecipients} />
      </section>

      {campaign.queueStats && (
        <section className="mb-6">
          <h2 className="text-sm font-medium mb-2">Queue</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Pending" value={campaign.queueStats.pending ?? 0} />
            <Stat label="Sent" value={campaign.queueStats.sent ?? 0} />
            <Stat label="Failed" value={campaign.queueStats.failed ?? 0} />
            <Stat label="Bounced" value={campaign.queueStats.bounced ?? 0} />
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-medium mb-2">Recipients</h2>
        <QueueTable queue={queue} />
      </section>

      <footer className="pt-4 border-t flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete campaign'}
        </Button>
      </footer>
    </>
  )
}

function QueueTable({ queue }: { queue: QueueState }) {
  if (queue.kind === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">Loading recipients…</p>
    )
  }
  if (queue.kind === 'error') {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load recipients: {queue.message}
      </p>
    )
  }
  if (queue.entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recipients queued.</p>
    )
  }
  return (
    <div className="rounded border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Recipient</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Attempts</th>
            <th className="px-3 py-2 font-medium">Last activity</th>
            <th className="px-3 py-2 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {queue.entries.map((row) => {
            const badge = describeQueueStatus(row.status)
            const lastTs = row.sentAt ?? row.lastAttemptAt ?? row.scheduledFor
            return (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  <div>{row.recipientEmail}</div>
                  {row.recipientName && (
                    <div className="text-xs text-muted-foreground">
                      {row.recipientName}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    data-tone={badge.tone}
                    className="text-xs px-2 py-0.5 rounded bg-muted"
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {row.attemptCount} / {row.maxAttempts}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatRelativeTime(lastTs)}
                </td>
                <td className="px-3 py-2 text-red-600">
                  {summarizeError(row.errorMessage)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {queue.hasMore && (
        <p className="px-3 py-2 text-xs text-muted-foreground border-t">
          Showing the first 100 recipients. Pagination coming soon.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
