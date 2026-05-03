import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { requireAuth, AuthorizationError } from '@/lib/authorization';
import {
  createCampaign,
  bulkCreateQueueEntries,
  getEmailAccountById,
  getCampaignsByUserId,
  updateCampaignStatus,
} from '@coldflow/db';

/**
 * POST /api/campaigns
 *
 * Create a new email campaign and queue emails for sending.
 */

const RecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  subAgencyId: z.string().optional().nullable(),
  emailAccountId: z.string(),
  recipients: z.array(RecipientSchema).min(1).max(10000),
  subject: z.string().min(1),
  bodyHtml: z.string().optional(),
  bodyText: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
  priority: z.number().min(0).max(10).optional().default(0),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = CreateCampaignSchema.parse(body);

    // Verify email account exists and belongs to user
    const emailAccount = await getEmailAccountById(validatedData.emailAccountId);

    if (!emailAccount) {
      return NextResponse.json(
        { success: false, error: 'Email account not found' },
        { status: 404 }
      );
    }

    if (emailAccount.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to use this email account' },
        { status: 403 }
      );
    }

    if (emailAccount.status !== 'connected') {
      return NextResponse.json(
        {
          success: false,
          error: `Email account is ${emailAccount.status}. Please reconnect before creating campaigns.`,
        },
        { status: 400 }
      );
    }

    // Create the campaign
    const campaign = await createCampaign({
      id: nanoid(),
      userId: user.id,
      subAgencyId: validatedData.subAgencyId || null,
      name: validatedData.name,
      status: 'draft',
      totalRecipients: validatedData.recipients.length,
    });

    // Create queue entries for all recipients
    const queueEntries = validatedData.recipients.map((recipient) => {
      // Simple variable replacement for subject and body
      let subject = validatedData.subject;
      let bodyHtml = validatedData.bodyHtml || '';
      let bodyText = validatedData.bodyText;

      if (recipient.variables) {
        Object.entries(recipient.variables).forEach(([key, value]) => {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          subject = subject.replace(placeholder, value);
          bodyHtml = bodyHtml.replace(placeholder, value);
          bodyText = bodyText.replace(placeholder, value);
        });
      }

      // Generate unique tracking ID
      const trackingId = nanoid();

      return {
        id: nanoid(),
        campaignId: campaign.id,
        emailAccountId: validatedData.emailAccountId,
        recipientEmail: recipient.email.toLowerCase(),
        recipientName: recipient.name || null,
        subject,
        bodyHtml: bodyHtml || null,
        bodyText,
        scheduledFor: validatedData.scheduledFor
          ? new Date(validatedData.scheduledFor)
          : new Date(),
        status: 'pending' as const,
        priority: validatedData.priority || 0,
        attemptCount: 0,
        maxAttempts: 3,
        trackingId,
      };
    });

    // Bulk insert queue entries
    await bulkCreateQueueEntries(queueEntries);

    // Update campaign status to scheduled
    await updateCampaignStatus(campaign.id, 'scheduled');

    return NextResponse.json(
      {
        success: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: 'scheduled',
          totalRecipients: campaign.totalRecipients,
          createdAt: campaign.createdAt,
        },
        queuedEmails: queueEntries.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating campaign:', error);

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns
 *
 * List campaigns for the authenticated user.
 */

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const subAgencyId = searchParams.get('subAgencyId');
    const status = searchParams.get('status') as 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch campaigns
    const campaigns = await getCampaignsByUserId(user.id, {
      subAgencyId: subAgencyId || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      campaigns: campaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        openCount: campaign.openCount,
        clickCount: campaign.clickCount,
        replyCount: campaign.replyCount,
        bounceCount: campaign.bounceCount,
        unsubscribeCount: campaign.unsubscribeCount,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      })),
      pagination: {
        limit,
        offset,
        hasMore: campaigns.length === limit,
      },
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}
