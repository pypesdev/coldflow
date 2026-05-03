import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthorizationError } from '@/lib/authorization';
import {
  getEmailAccountById,
  deleteEmailAccount,
  getPendingCountForEmailAccount,
} from '@coldflow/db';

/**
 * DELETE /api/email-accounts/[id]
 *
 * Disconnect/delete an email account.
 * Prevents deletion if there are pending emails in the queue.
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate user
    const user = await requireAuth();

    // Verify account exists and belongs to user
    const account = await getEmailAccountById(id);

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Email account not found' },
        { status: 404 }
      );
    }

    if (account.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to delete this account' },
        { status: 403 }
      );
    }

    // Check if there are pending emails for this account
    const pendingCount = await getPendingCountForEmailAccount(id);

    if (pendingCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete account with ${pendingCount} pending emails. Please wait for them to send or cancel the campaigns.`,
        },
        { status: 409 }
      );
    }

    // Delete the account
    const deleted = await deleteEmailAccount(id, user.id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete email account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email account disconnected successfully',
    });
  } catch (error) {
    console.error('Error deleting email account:', error);

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete email account' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email-accounts/[id]
 *
 * Get a single email account by ID (without sensitive token data)
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate user
    const user = await requireAuth();

    // Fetch account
    const account = await getEmailAccountById(id);

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Email account not found' },
        { status: 404 }
      );
    }

    if (account.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this account' },
        { status: 403 }
      );
    }

    // Return account without encrypted tokens
    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        provider: account.provider,
        status: account.status,
        dailyQuota: account.dailyQuota,
        quotaUsedToday: account.quotaUsedToday,
        quotaResetAt: account.quotaResetAt,
        lastSyncedAt: account.lastSyncedAt,
        errorMessage: account.errorMessage,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching email account:', error);

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch email account' },
      { status: 500 }
    );
  }
}
