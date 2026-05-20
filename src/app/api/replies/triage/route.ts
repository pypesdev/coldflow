import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { triageReply } from "@/lib/replyTriage";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

/**
 * POST /api/replies/triage
 *
 * Stateless reply classifier. Pass a reply body and (optionally) original
 * subject + recipient name; receive `{intent, confidence, suggested_followup}`.
 * Used both by the inbound-reply ingest path (server-side, on landing) and
 * by the UI when the user clicks "Re-triage" on a card.
 *
 * Auth: session — this is a logged-in feature.
 */
const TriageRequestSchema = z.object({
  replyBody: z.string().min(1).max(50000),
  originalSubject: z.string().max(500).optional(),
  recipientName: z.string().max(200).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const parsed = TriageRequestSchema.parse(body);

    const result = await triageReply({
      replyBody: parsed.replyBody,
      originalSubject: parsed.originalSubject,
      recipientName: parsed.recipientName ?? null,
    });

    return NextResponse.json({
      success: true,
      intent: result.intent,
      confidence: result.confidence,
      suggested_followup: result.suggestedFollowup,
      source: result.source,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error in /api/replies/triage:", error);
    return NextResponse.json(
      { success: false, error: "Failed to triage reply" },
      { status: 500 }
    );
  }
}
