'use client'
import { useCallback, useEffect, useState } from 'react'

interface FollowupRow {
  id: string
  sequenceId: string
  sequenceName: string | null
  recipientEmail: string
  lastReplyAt: string
  lastReplyExcerpt: string | null
  scheduledSendAt: string
  status: 'scheduled' | 'sent' | 'cancelled'
  createdAt: string
}

export default function FollowUpsPage() {
  const [followups, setFollowups] = useState<FollowupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/follow-ups')
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Failed to load')
        return
      }
      setFollowups(json.followups ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cancel = async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/follow-ups/${id}/cancel`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Failed to cancel')
        return
      }
      setFollowups((current) => current.filter((row) => row.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Pending follow-ups</h1>
        <p className="text-muted-foreground mb-6">
          Silent-reply follow-ups scheduled for prospects who replied with a
          question or pricing/details request and then went quiet.
        </p>

        {error && (
          <div className="border border-destructive bg-destructive/10 text-destructive rounded-md p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : followups.length === 0 ? (
          <p className="text-muted-foreground">No pending follow-ups.</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Recipient</th>
                  <th className="px-4 py-2 font-medium">Sequence</th>
                  <th className="px-4 py-2 font-medium">Reply excerpt</th>
                  <th className="px-4 py-2 font-medium">Sends at</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {followups.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 break-all">{row.recipientEmail}</td>
                    <td className="px-4 py-3">{row.sequenceName ?? row.sequenceId}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md">
                      {row.lastReplyExcerpt ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(row.scheduledSendAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => cancel(row.id)}
                        disabled={cancellingId === row.id}
                        className="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {cancellingId === row.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
