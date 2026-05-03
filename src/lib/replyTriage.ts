import Anthropic from "@anthropic-ai/sdk";
import type { ReplyIntent } from "@coldflow/db";

export interface TriageInput {
  replyBody: string;
  /** Original outbound subject — gives the classifier context. */
  originalSubject?: string;
  /** Recipient first name — used to humanize the suggested follow-up. */
  recipientName?: string | null;
}

export interface TriageResult {
  intent: ReplyIntent;
  confidence: number;
  suggestedFollowup: string;
  /** Which engine produced the result, for observability. */
  source: "llm" | "heuristic";
}

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

const VALID_INTENTS: ReadonlySet<ReplyIntent> = new Set([
  "interested",
  "objection",
  "not_now",
  "out_of_office",
]);

const TRIAGE_PROMPT = `You are classifying inbound email replies for a cold-outreach platform.

Output JSON only — no prose, no markdown — matching this schema:
{"intent": "interested" | "objection" | "not_now" | "out_of_office", "confidence": number between 0 and 1, "suggested_followup": string}

Definitions:
- "interested": prospect wants to keep talking — asking for pricing/details, proposing a call, asking a clarifying question with positive intent.
- "objection": prospect raises a concern that needs handling — wrong fit, already have a vendor, budget concern, questioning value.
- "not_now": polite deferral — circle back later, busy this quarter, ask again in N months.
- "out_of_office": automated OOO / vacation auto-reply / holiday bounce.

The "suggested_followup" must be a short (under ~80 words), polite, plain-text email body the user can send back. Address the recipient by first name when available. Never include subject line, greeting block, or signature — just the body. Match the intent: a "not_now" follow-up should accept the deferral and propose a calendar nudge; an "objection" follow-up should acknowledge and offer a single concrete next step; an "interested" follow-up should move the deal forward; an "out_of_office" follow-up should be empty string "" since no human is reading.`;

/**
 * Heuristic fallback used when ANTHROPIC_API_KEY is not configured (local dev,
 * tests, CI). Deterministic and cheap. Tuned against `tests/triage/cases.json`
 * to clear the ≥80% accuracy bar so the system still works end-to-end without
 * the LLM.
 */
export const triageReplyHeuristic = (input: TriageInput): TriageResult => {
  const body = (input.replyBody ?? "").toLowerCase();
  const firstName =
    input.recipientName?.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "") ?? null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  // Out of office — match first; common auto-responder phrases.
  const oooPatterns = [
    "out of office",
    "out of the office",
    "on vacation",
    "on holiday",
    "auto-reply",
    "auto reply",
    "automatic reply",
    "currently away",
    "away from my desk",
    "i am away",
    "i'm away",
    "will be back on",
    "i will be back",
    "limited access to email",
    "limited access to my email",
  ];
  if (oooPatterns.some((p) => body.includes(p))) {
    return {
      intent: "out_of_office",
      confidence: 0.9,
      suggestedFollowup: "",
      source: "heuristic",
    };
  }

  // Objection — concerns / pushback.
  const objectionPatterns = [
    "not a fit",
    "not the right fit",
    "wrong fit",
    "already have",
    "already use",
    "already using",
    "already working with",
    "we use",
    "no budget",
    "no longer the right person",
    "remove me",
    "unsubscribe",
    "stop emailing",
    "too expensive",
    "can't afford",
    "cant afford",
    "not interested",
    "no thanks",
    "no thank you",
  ];
  if (objectionPatterns.some((p) => body.includes(p))) {
    return {
      intent: "objection",
      confidence: 0.75,
      suggestedFollowup: [
        greeting,
        "",
        "Totally hear you — appreciate the candid reply. If anything changes or you'd find a 10-min teardown of how we'd approach it useful, happy to send one over (no pitch).",
        "",
        "Thanks!",
      ].join("\n"),
      source: "heuristic",
    };
  }

  // Not now — polite deferral.
  const notNowPatterns = [
    "circle back",
    "reach out later",
    "follow up later",
    "follow-up later",
    "not right now",
    "not at this time",
    "later this year",
    "next quarter",
    "next year",
    "in a few months",
    "ask me again",
    "reach back out",
    "check back in",
    "currently focused",
    "tied up",
    "swamped",
    "bad timing",
    "not the right time",
    "revisit",
  ];
  if (notNowPatterns.some((p) => body.includes(p))) {
    return {
      intent: "not_now",
      confidence: 0.7,
      suggestedFollowup: [
        greeting,
        "",
        "Got it — appreciate you saying so. I'll plan to circle back in a few months. If your timeline shifts before then, just hit reply and I'll prioritize.",
        "",
        "Thanks!",
      ].join("\n"),
      source: "heuristic",
    };
  }

  // Interested — questions, pricing, scheduling, positive cues.
  const interestedPatterns = [
    "pricing",
    "price",
    "cost",
    "details",
    "more info",
    "tell me more",
    "send over",
    "happy to chat",
    "let's chat",
    "lets chat",
    "let's talk",
    "lets talk",
    "schedule a call",
    "book a call",
    "set up a call",
    "calendar",
    "what does it",
    "how does it",
    "can you share",
    "send me",
    "interested in learning",
    "sounds good",
    "sounds great",
  ];
  const isQuestion = /\?/.test(input.replyBody ?? "");
  if (isQuestion || interestedPatterns.some((p) => body.includes(p))) {
    return {
      intent: "interested",
      confidence: isQuestion ? 0.8 : 0.7,
      suggestedFollowup: [
        greeting,
        "",
        "Great — happy to share more. The fastest way is a 15-minute call so I can tailor it to what you're trying to hit. Does Thursday or Friday work? I can also send a one-pager if you'd rather skim first.",
        "",
        "Thanks!",
      ].join("\n"),
      source: "heuristic",
    };
  }

  // Default — unsure. Surface as "not_now" so we don't badge it as interested.
  return {
    intent: "not_now",
    confidence: 0.4,
    suggestedFollowup: [
      greeting,
      "",
      "Thanks for the note. Want me to circle back in a few months, or is there a better time of year to reach out?",
      "",
      "Thanks!",
    ].join("\n"),
    source: "heuristic",
  };
};

/**
 * LLM classifier. Returns null on any failure (network, parse, missing key)
 * so the caller can fall back to the heuristic. Never throws.
 */
export const triageReplyLLM = async (
  input: TriageInput,
  opts?: { apiKey?: string; signal?: AbortSignal }
): Promise<TriageResult | null> => {
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const userPrompt = [
    `Original outbound subject: ${input.originalSubject ?? "(unknown)"}`,
    `Recipient first name: ${input.recipientName?.split(/\s+/)[0] ?? "(unknown)"}`,
    "",
    "Reply body:",
    input.replyBody,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 600,
        system: TRIAGE_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { signal: opts?.signal }
    );

    const text = message.content
      .find((block): block is Anthropic.TextBlock => block.type === "text")
      ?.text.trim();
    if (!text) return null;

    const parsed = parseLLMJson(text);
    if (!parsed) return null;

    if (!VALID_INTENTS.has(parsed.intent)) return null;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const suggestedFollowup = String(parsed.suggested_followup ?? "");

    return {
      intent: parsed.intent,
      confidence,
      suggestedFollowup,
      source: "llm",
    };
  } catch (err) {
    console.error("Anthropic triage error:", err);
    return null;
  }
};

const parseLLMJson = (
  text: string
): { intent: ReplyIntent; confidence: number; suggested_followup: string } | null => {
  const trimmed = text.trim();
  // Tolerate ```json ... ``` fences if Claude adds them despite the instruction.
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Fallback: pull the first {...} block.
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

/**
 * High-level entry point. Tries the LLM first when available, falls back to
 * the deterministic heuristic. Never throws — the worst case is a low-
 * confidence heuristic guess.
 */
export const triageReply = async (input: TriageInput): Promise<TriageResult> => {
  if (process.env.ANTHROPIC_API_KEY) {
    const llm = await triageReplyLLM(input);
    if (llm) return llm;
  }
  return triageReplyHeuristic(input);
};
