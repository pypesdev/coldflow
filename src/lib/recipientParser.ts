export type ParsedRecipient = {
  email: string
  name?: string
  /**
   * Default per-recipient template variables. Always includes `email`. Adds
   * `first_name` / `last_name` when an angle-format name was supplied; falls
   * back to a title-cased email local-part for `first_name` so that templates
   * like "Hi {{first_name}}," never render with literal braces.
   *
   * The campaign API also accepts caller-supplied variables (e.g. from a CSV
   * import) and these defaults can be overridden per-recipient.
   */
  variables: Record<string, string>
}

export type RecipientParseResult = {
  recipients: ParsedRecipient[]
  invalid: string[]
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseRecipients(input: string): RecipientParseResult {
  const recipients: ParsedRecipient[] = []
  const invalid: string[] = []
  const seen = new Set<string>()

  for (const segment of splitSegments(input)) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    let email: string
    let name: string | undefined

    const angleStart = trimmed.lastIndexOf('<')
    const angleEnd = trimmed.lastIndexOf('>')
    if (angleStart !== -1 && angleEnd > angleStart) {
      const rawName = trimmed.slice(0, angleStart).trim()
      email = trimmed.slice(angleStart + 1, angleEnd).trim()
      name =
        rawName
          .replace(/^"(.*)"$/, '$1')
          .trim() || undefined
    } else {
      email = trimmed
    }

    if (!EMAIL_PATTERN.test(email)) {
      invalid.push(trimmed)
      continue
    }

    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const variables = deriveVariables({ email, name })
    recipients.push(name ? { email, name, variables } : { email, variables })
  }

  return { recipients, invalid }
}

/**
 * Derive default template variables for a recipient. Pure function — exposed
 * so callers (CSV importers, API clients) can use the same conventions.
 */
export function deriveVariables({
  email,
  name,
}: {
  email: string
  name?: string
}): Record<string, string> {
  const vars: Record<string, string> = { email }

  const nameParts = (name ?? '').split(/\s+/).filter((p) => p.length > 0)
  if (nameParts.length > 0) {
    vars.first_name = nameParts[0]
    if (nameParts.length > 1) {
      vars.last_name = nameParts.slice(1).join(' ')
    }
    return vars
  }

  // Fall back to a title-cased email local-part so a bare email like
  // jane.doe@example.com still produces a usable {{first_name}}.
  const localPart = email.split('@')[0] ?? ''
  const firstChunk = localPart
    .split(/[._\-+]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)[0]
  if (firstChunk) {
    vars.first_name =
      firstChunk.charAt(0).toUpperCase() + firstChunk.slice(1).toLowerCase()
  }

  return vars
}

function splitSegments(input: string): string[] {
  const segments: string[] = []
  let buf = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      buf += ch
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === ',' || ch === ';')) {
      segments.push(buf)
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf) segments.push(buf)
  return segments
}
