'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Intent = 'interested' | 'objection' | 'not_now' | 'out_of_office'
type Status = 'new' | 'actioned' | 'archived'

interface ReplyRow {
  id: string
  campaignId: string
  campaignName: string | null
  recipientEmail: string
  recipientName: string | null
  body: string
  intent: Intent
  confidence: number
  suggestedFollowup: string
  status: Status
  receivedAt: string
  actionedAt: string | null
  archivedAt: string | null
}

const TABS: { intent: Intent; label: string }[] = [
  { intent: 'interested', label: 'Interested' },
  { intent: 'objection', label: 'Objection' },
  { intent: 'not_now', label: 'Not Now' },
  { intent: 'out_of_office', label: 'Out of Office' },
]

export default function RepliesPage() {
  const [activeTab, setActiveTab] = useState<Intent>('interested')
  const [replies, setReplies] = useState<ReplyRow[]>([])
  const [counts, setCounts] = useState<Record<Intent, number>>({
    interested: 0,
    objection: 0,
    not_now: 0,
    out_of_office: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})

  const load = useCallback(async (intent: Intent) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/replies?intent=${intent}&status=new`)
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Failed to load')
        return
      }
      setReplies(json.replies ?? [])
      setCounts(json.counts ?? counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load(activeTab)
  }, [activeTab, load])

  const visible = useMemo(
    () => replies.filter((r) => r.intent === activeTab),
    [replies, activeTab]
  )

  const draftFor = (row: ReplyRow): string =>
    editing[row.id] ?? row.suggestedFollowup

  const setDraft = (id: string, value: string) =>
    setEditing((current) => ({ ...current, [id]: value }))

  const send = async (row: ReplyRow) => {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/replies/${row.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyOverride: draftFor(row) }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Failed to send')
        return
      }
      setReplies((current) => current.filter((r) => r.id !== row.id))
      setCounts((current) => ({
        ...current,
        [row.intent]: Math.max(0, current[row.intent] - 1),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setBusyId(null)
    }
  }

  const saveEdit = async (row: ReplyRow) => {
    const next = draftFor(row)
    if (next === row.suggestedFollowup) return
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/replies/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestedFollowup: next }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Failed to save')
        return
      }
      setReplies((current) =>
        current.map((r) =>
          r.id === row.id ? { ...r, suggestedFollowup: next } : r
        )
      )
      setEditing((current) => {
        const { [row.id]: _, ...rest } = current
        return rest
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusyId(null)
    }
  }

  const archive = async (row: ReplyRow) => {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/replies/${row.id}/archive`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Failed to archive')
        return
      }
      setReplies((current) => current.filter((r) => r.id !== row.id))
      setCounts((current) => ({
        ...current,
        [row.intent]: Math.max(0, current[row.intent] - 1),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Replies</h1>
        <p className="text-muted-foreground mb-6">
          Inbound replies bucketed by intent. Edit the suggested follow-up if
          you want, then [Send] to queue it through your sending account.
        </p>

        {error && (
          <div className="border border-destructive bg-destructive/10 text-destructive rounded-md p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-6 border-b border-border">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.intent
            return (
              <button
                key={tab.intent}
                onClick={() => setActiveTab(tab.intent)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted">
                  {counts[tab.intent] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground">No replies in this bucket.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((row) => {
              const draft = draftFor(row)
              const dirty = draft !== row.suggestedFollowup
              const isBusy = busyId === row.id
              return (
                <div
                  key={row.id}
                  className="border border-border rounded-md p-4 bg-card"
                >
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <div className="font-medium break-all">
                        {row.recipientName
                          ? `${row.recipientName} <${row.recipientEmail}>`
                          : row.recipientEmail}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.campaignName ?? row.campaignId} ·{' '}
                        {new Date(row.receivedAt).toLocaleString()} · confidence{' '}
                        {Math.round(row.confidence * 100)}%
                      </div>
                    </div>
                  </div>

                  <details className="text-sm mb-3">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Reply body
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded text-foreground">
                      {row.body}
                    </pre>
                  </details>

                  <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Suggested follow-up
                  </label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(row.id, e.target.value)}
                    className="w-full border border-border rounded-md p-3 text-sm font-mono bg-background"
                    rows={6}
                    disabled={isBusy}
                  />

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => send(row)}
                      disabled={isBusy || draft.trim().length === 0}
                      className="px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isBusy ? 'Sending…' : 'Send'}
                    </button>
                    <button
                      onClick={() => saveEdit(row)}
                      disabled={isBusy || !dirty}
                      className="px-4 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      {dirty ? 'Save edit' : 'Edited'}
                    </button>
                    <button
                      onClick={() => archive(row)}
                      disabled={isBusy}
                      className="px-4 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 ml-auto"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
