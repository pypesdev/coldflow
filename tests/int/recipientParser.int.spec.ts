import { describe, expect, it } from 'vitest'
import { parseRecipients } from '@/lib/recipientParser'

describe('parseRecipients', () => {
  it('parses bare emails one per line', () => {
    const r = parseRecipients('alice@example.com\nbob@example.com')
    expect(r.recipients).toEqual([
      { email: 'alice@example.com' },
      { email: 'bob@example.com' },
    ])
    expect(r.invalid).toEqual([])
  })

  it('parses Name <email> angle format', () => {
    const r = parseRecipients('Alice Smith <alice@example.com>')
    expect(r.recipients).toEqual([
      { email: 'alice@example.com', name: 'Alice Smith' },
    ])
  })

  it('strips quotes around angle-format names', () => {
    const r = parseRecipients('"Alice, Q." <alice@example.com>')
    expect(r.recipients[0]).toEqual({
      email: 'alice@example.com',
      name: 'Alice, Q.',
    })
  })

  it('accepts comma and semicolon separators in addition to newlines', () => {
    const r = parseRecipients('a@x.com, b@x.com; c@x.com')
    expect(r.recipients.map((p) => p.email)).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ])
  })

  it('dedupes case-insensitively, preserving first-seen casing', () => {
    const r = parseRecipients('Alice@Example.com\nalice@example.com')
    expect(r.recipients).toHaveLength(1)
    expect(r.recipients[0].email).toBe('Alice@Example.com')
  })

  it('rejects malformed addresses and lists them in invalid', () => {
    const r = parseRecipients('not-an-email\nbob@example.com\n@nope')
    expect(r.recipients.map((p) => p.email)).toEqual(['bob@example.com'])
    expect(r.invalid).toEqual(['not-an-email', '@nope'])
  })

  it('ignores blank lines and surrounding whitespace', () => {
    const r = parseRecipients('\n  alice@example.com  \n\n  bob@example.com\n')
    expect(r.recipients).toHaveLength(2)
  })

  it('returns empty result for empty input', () => {
    expect(parseRecipients('')).toEqual({ recipients: [], invalid: [] })
    expect(parseRecipients('   \n\n  ')).toEqual({ recipients: [], invalid: [] })
  })

  it('omits the name key entirely when angle name is empty', () => {
    const r = parseRecipients('   <alice@example.com>')
    expect(r.recipients[0]).toEqual({ email: 'alice@example.com' })
    expect('name' in r.recipients[0]).toBe(false)
  })
})
