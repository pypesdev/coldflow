/**
 * Helpers for the AI personalization endpoint.
 *
 * Splits the work into two pure pieces so they can be unit-tested without an
 * Anthropic key: pre-filling known `{{vars}}` from contact data, and parsing
 * the JSON envelope Claude is asked to return.
 */

import { extractPlaceholders } from './catalog'

export type PersonalizeContact = {
  name: string
  company: string
  role: string
  optional_context?: Record<string, string>
}

const PLACEHOLDER_REPLACE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function buildVariableMap(contact: PersonalizeContact): Record<string, string> {
  const ctx = contact.optional_context ?? {}
  const map: Record<string, string> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string' && v.length > 0) map[k] = v
  }
  // Contact fields take priority over optional_context for the canonical names.
  if (contact.name) {
    map.first_name = firstName(contact.name)
    map.full_name = contact.name.trim()
  }
  if (contact.company) map.company = contact.company.trim()
  if (contact.role) {
    map.role = contact.role.trim()
    map.role_title = contact.role.trim()
  }
  return map
}

export type PrefillResult = {
  subject: string
  body: string
  filled: string[]
  remaining: string[]
}

export function prefillTemplate(
  subject: string,
  body: string,
  contact: PersonalizeContact,
): PrefillResult {
  const map = buildVariableMap(contact)
  const filled = new Set<string>()
  const replace = (text: string) =>
    text.replace(PLACEHOLDER_REPLACE_RE, (match, name: string) => {
      const value = map[name]
      if (value === undefined) return match
      filled.add(name)
      return value
    })
  const filledSubject = replace(subject)
  const filledBody = replace(body)
  const remaining = Array.from(
    new Set([
      ...extractPlaceholders(filledSubject),
      ...extractPlaceholders(filledBody),
    ]),
  )
  return {
    subject: filledSubject,
    body: filledBody,
    filled: Array.from(filled),
    remaining,
  }
}

export type ClaudeEnvelope = {
  personalized_subject: string
  personalized_body: string
  personalization_notes?: string
}

export class PersonalizationFormatError extends Error {}

export function parseClaudeEnvelope(text: string): ClaudeEnvelope {
  // Claude is instructed to return strict JSON, but it occasionally wraps the
  // response in a fenced block. Strip a single surrounding ```json ... ```
  // before parsing so the endpoint stays robust to that one common drift.
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const payload = fenced ? fenced[1] : trimmed
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch (err) {
    throw new PersonalizationFormatError(
      `Claude returned non-JSON output: ${(err as Error).message}`,
    )
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).personalized_subject !== 'string' ||
    typeof (parsed as Record<string, unknown>).personalized_body !== 'string'
  ) {
    throw new PersonalizationFormatError(
      'Claude response missing personalized_subject or personalized_body',
    )
  }
  return parsed as ClaudeEnvelope
}

export function buildPersonalizationPrompt(args: {
  subject: string
  body: string
  contact: PersonalizeContact
  remainingVariables: string[]
}): { system: string; user: string } {
  const { subject, body, contact, remainingVariables } = args
  const system = `You personalize cold-email drafts for the coldflow open-source tool. \
Rewrite the draft so it (a) fills any remaining {{placeholders}} with sensible \
values inferred from the contact, and (b) adds at most two light personalization \
touches that acknowledge the recipient's role and reference their company \
specifically. Do not lengthen the email by more than ~15%, do not change the \
core CTA, and never invent facts not supported by the contact data. Return \
ONLY a JSON object with keys personalized_subject, personalized_body, and an \
optional short personalization_notes string. No prose outside the JSON.`

  const user = `Contact:
${JSON.stringify(contact, null, 2)}

Remaining placeholders that must be filled: ${
    remainingVariables.length > 0
      ? remainingVariables.map((v) => `{{${v}}}`).join(', ')
      : '(none — only add personalization touches)'
  }

Draft subject:
${subject}

Draft body:
${body}`

  return { system, user }
}
