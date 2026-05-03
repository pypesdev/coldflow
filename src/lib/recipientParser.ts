export type ParsedRecipient = {
  email: string
  name?: string
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

    recipients.push(name ? { email, name } : { email })
  }

  return { recipients, invalid }
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
