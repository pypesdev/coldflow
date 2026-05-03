'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  describeCampaignStatus,
  formatCampaignProgress,
} from '@/lib/campaignStatus'

type CampaignSummary = {
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
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; campaigns: CampaignSummary[] }
  | { kind: 'error'; message: string }

export default function CampaignsListPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/campaigns')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Failed (${res.status})`)
        }
        return data.campaigns as CampaignSummary[]
      })
      .then((campaigns) => {
        if (!cancelled) setState({ kind: 'ready', campaigns })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <Link href="/dashboard/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        </header>

        {state.kind === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading campaigns…</p>
        )}

        {state.kind === 'error' && (
          <p className="text-sm text-red-600">
            Couldn&apos;t load campaigns: {state.message}
          </p>
        )}

        {state.kind === 'ready' && state.campaigns.length === 0 && (
          <div className="rounded border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              You haven&apos;t created any campaigns yet.
            </p>
            <Link href="/dashboard/campaigns/new">
              <Button>Create your first campaign</Button>
            </Link>
          </div>
        )}

        {state.kind === 'ready' && state.campaigns.length > 0 && (
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Sent</th>
                  <th className="px-4 py-2 font-medium">Replies</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {state.campaigns.map((c) => {
                  const badge = describeCampaignStatus(c.status)
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          data-tone={badge.tone}
                          className="text-xs px-2 py-0.5 rounded bg-muted"
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {formatCampaignProgress({
                          totalRecipients: c.totalRecipients,
                          sentCount: c.sentCount,
                        })}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{c.replyCount}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
