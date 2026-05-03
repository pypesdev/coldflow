/**
 * POST /api/personalize
 *
 * Take a `template_id` and a `contact` and return a personalized variant of
 * the template via Claude. Contact-known placeholders are filled server-side;
 * remaining placeholders + 1–2 light personalization touches come from the LLM.
 *
 * Usage tokens are logged so we can track spend per call.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import { requireAuth, AuthorizationError } from '@/lib/authorization'
import { rateLimiter } from '@/lib/rateLimiter'
import { extractPlaceholders } from '@/lib/templates/catalog'
import { resolveTemplateById } from '@/lib/templates/resolver'
import {
  buildPersonalizationPrompt,
  parseClaudeEnvelope,
  PersonalizationFormatError,
  prefillTemplate,
  type PersonalizeContact,
} from '@/lib/templates/personalize'

const PERSONALIZE_MAX_REQUESTS = 1
const PERSONALIZE_WINDOW_MS = 2_000
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

const personalizeSchema = z.object({
  template_id: z.string().min(1),
  contact: z
    .object({
      name: z.string().min(1).max(200),
      company: z.string().min(1).max(200),
      role: z.string().min(1).max(200),
    })
    .catchall(z.union([z.string().max(2_000), z.undefined()])),
})

function normalizeContact(input: z.infer<typeof personalizeSchema>['contact']): PersonalizeContact {
  const { name, company, role, ...rest } = input
  const optional_context: Record<string, string> = {}
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === 'string' && v.length > 0) optional_context[k] = v
  }
  return {
    name: name as string,
    company: company as string,
    role: role as string,
    optional_context: Object.keys(optional_context).length > 0 ? optional_context : undefined,
  }
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireAuth()
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }

  const limit = rateLimiter.check(
    `personalize:${user.id}`,
    PERSONALIZE_MAX_REQUESTS,
    PERSONALIZE_WINDOW_MS,
  )
  if (limit.isLimited) {
    return NextResponse.json(
      {
        error: 'Too many personalization requests — please wait a moment',
        retry_after_seconds: limit.retryAfter,
      },
      {
        status: 429,
        headers: limit.retryAfter
          ? { 'Retry-After': String(limit.retryAfter) }
          : undefined,
      },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI personalization is not configured (missing ANTHROPIC_API_KEY)' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = personalizeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const template = await resolveTemplateById(parsed.data.template_id)
  if (!template) {
    return NextResponse.json(
      { error: `Template not found: ${parsed.data.template_id}` },
      { status: 404 },
    )
  }

  const contact = normalizeContact(parsed.data.contact)
  const prefilled = prefillTemplate(template.subject, template.body, contact)

  const prompt = buildPersonalizationPrompt({
    subject: prefilled.subject,
    body: prefilled.body,
    contact,
    remainingVariables: prefilled.remaining,
  })

  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_PERSONALIZE_MODEL || DEFAULT_MODEL

  let aiResponse
  try {
    aiResponse = await client.messages.create({
      model,
      max_tokens: 1024,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    })
  } catch (err) {
    console.error('[personalize] Anthropic call failed', err)
    return NextResponse.json(
      { error: 'Failed to call AI provider' },
      { status: 502 },
    )
  }

  const textPart = aiResponse.content.find((block) => block.type === 'text')
  if (!textPart || textPart.type !== 'text') {
    return NextResponse.json(
      { error: 'AI response contained no text' },
      { status: 502 },
    )
  }

  let envelope
  try {
    envelope = parseClaudeEnvelope(textPart.text)
  } catch (err) {
    if (err instanceof PersonalizationFormatError) {
      console.error('[personalize] format error', err.message)
      return NextResponse.json(
        { error: 'AI response was not in the expected format' },
        { status: 502 },
      )
    }
    throw err
  }

  const leftoverInSubject = extractPlaceholders(envelope.personalized_subject)
  const leftoverInBody = extractPlaceholders(envelope.personalized_body)
  const leftover = Array.from(new Set([...leftoverInSubject, ...leftoverInBody]))
  if (leftover.length > 0) {
    return NextResponse.json(
      {
        error: 'AI response left placeholders unfilled',
        leftover,
      },
      { status: 502 },
    )
  }

  const usedFromContact = prefilled.filled
  const filledByAi = prefilled.remaining
  const usedVariables = Array.from(new Set([...usedFromContact, ...filledByAi]))

  const usage = {
    input_tokens: aiResponse.usage.input_tokens,
    output_tokens: aiResponse.usage.output_tokens,
    model,
  }

  console.log(
    '[personalize] user=%s template=%s tokens=%d/%d model=%s',
    user.id,
    template.id,
    usage.input_tokens,
    usage.output_tokens,
    model,
  )

  return NextResponse.json({
    personalized_subject: envelope.personalized_subject,
    personalized_body: envelope.personalized_body,
    used_variables: usedVariables,
    original_subject: template.subject,
    original_body: template.body,
    personalization_notes: envelope.personalization_notes,
    usage,
  })
}
