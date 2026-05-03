import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthorizationError } from '@/lib/authorization'
import {
  getCampaignWithStats,
  getQueueEntriesByCampaign,
} from '@coldflow/db'

/**
 * GET /api/campaigns/[id]/queue
 *
 * Per-recipient queue entries for a campaign. Owner-checked. Paginated:
 * `?limit=N&offset=N` (defaults limit=100, offset=0; max limit=500).
 *
 * The campaign endpoint already returns aggregate counts; this surfaces
 * the per-row state so users can see who is pending / sent / failed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireAuth()

    // Verify the campaign exists and the requester owns it. Cheap, and
    // means the queue endpoint can never leak rows from another tenant.
    const campaign = await getCampaignWithStats(id)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 },
      )
    }
    if (campaign.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this campaign' },
        { status: 403 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = clamp(parseInt(searchParams.get('limit') || '100'), 1, 500)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))

    const entries = await getQueueEntriesByCampaign(id, limit, offset)

    return NextResponse.json({
      success: true,
      entries: entries.map((e) => ({
        id: e.id,
        recipientEmail: e.recipientEmail,
        recipientName: e.recipientName,
        status: e.status,
        attemptCount: e.attemptCount,
        maxAttempts: e.maxAttempts,
        scheduledFor: e.scheduledFor,
        lastAttemptAt: e.lastAttemptAt,
        sentAt: e.sentAt,
        errorMessage: e.errorMessage,
      })),
      pagination: {
        limit,
        offset,
        hasMore: entries.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching campaign queue:', error)
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode },
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaign queue' },
      { status: 500 },
    )
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}
