'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authClient } from '@/access/authClient'

interface CampaignStats {
  totalSent: number
  totalReplied: number
}

interface FollowupStats {
  pendingCount: number
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession()
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null)
  const [followupStats, setFollowupStats] = useState<FollowupStats | null>(null)

  useEffect(() => {
    if (!session?.user) return

    let cancelled = false
    const load = async () => {
      try {
        const [campaignsRes, followupsRes] = await Promise.all([
          fetch('/api/campaigns?limit=500'),
          fetch('/api/follow-ups?mode=count'),
        ])
        const campaignsJson = await campaignsRes.json()
        const followupsJson = await followupsRes.json()
        if (cancelled) return
        if (campaignsJson?.success) {
          const campaigns = campaignsJson.campaigns ?? []
          setCampaignStats({
            totalSent: campaigns.reduce(
              (sum: number, c: { sentCount: number }) => sum + (c.sentCount || 0),
              0,
            ),
            totalReplied: campaigns.reduce(
              (sum: number, c: { replyCount: number }) => sum + (c.replyCount || 0),
              0,
            ),
          })
        }
        if (followupsJson?.success) {
          setFollowupStats({ pendingCount: followupsJson.count ?? 0 })
        }
      } catch (err) {
        console.error('Failed to load dashboard stats', err)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [session?.user])

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Welcome to your Dashboard</h1>
        <p className="text-muted-foreground mb-6">Logged in as: {session?.user?.email}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Sent"
            value={campaignStats?.totalSent ?? null}
          />
          <StatCard
            label="Replied"
            value={campaignStats?.totalReplied ?? null}
          />
          <StatCard
            label="Pending follow-ups"
            value={followupStats?.pendingCount ?? null}
            href="/dashboard/follow-ups"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string
  value: number | null
  href?: string
}) {
  const inner = (
    <div className="border border-border rounded-md p-4 hover:border-primary transition-colors">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">
        {value === null ? '—' : value.toLocaleString()}
      </p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
