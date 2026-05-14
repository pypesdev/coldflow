import { describe, expect, it } from 'vitest'
import { deriveVariables, parseRecipients } from '@/lib/recipientParser'

describe('parseRecipients', () => {
  it('parses bare emails one per line', () => {
    const r = parseRecipients('alice@example.com\nbob@example.com')
    expect(r.recipients.map((p) => p.email)).toEqual([
      'alice@example.com',
      'bob@example.com',
    ])
    expect(r.invalid).toEqual([])
  })

  it('parses Name <email> angle format', () => {
    const r = parseRecipients('Alice Smith <alice@example.com>')
    expect(r.recipients).toHaveLength(1)
    expect(r.recipients[0].email).toBe('alice@example.com')
    expect(r.recipients[0].name).toBe('Alice Smith')
  })

  it('strips quotes around angle-format names', () => {
    const r = parseRecipients('"Alice, Q." <alice@example.com>')
    expect(r.recipients[0].email).toBe('alice@example.com')
    expect(r.recipients[0].name).toBe('Alice, Q.')
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
    expect(r.recipients[0].email).toBe('alice@example.com')
    expect('name' in r.recipients[0]).toBe(false)
  })

  it('emits per-recipient default variables', () => {
    const r = parseRecipients('Alice Smith <alice@example.com>\nbob@example.com')
    expect(r.recipients[0].variables).toEqual({
      email: 'alice@example.com',
      first_name: 'Alice',
      last_name: 'Smith',
    })
    expect(r.recipients[1].variables).toEqual({
      email: 'bob@example.com',
      first_name: 'Bob',
    })
  })
})

describe('deriveVariables', () => {
  it('always includes the email address', () => {
    expect(deriveVariables({ email: 'a@b.com' }).email).toBe('a@b.com')
  })

  it('splits a one-word name into first_name only', () => {
    const v = deriveVariables({ email: 'a@b.com', name: 'Alice' })
    expect(v.first_name).toBe('Alice')
    expect('last_name' in v).toBe(false)
  })

  it('splits a multi-word name into first_name and last_name', () => {
    const v = deriveVariables({ email: 'a@b.com', name: 'Alice Smith' })
    expect(v.first_name).toBe('Alice')
    expect(v.last_name).toBe('Smith')
  })

  it('keeps multi-word last names intact', () => {
    const v = deriveVariables({ email: 'a@b.com', name: 'Mary Jane Watson' })
    expect(v.first_name).toBe('Mary')
    expect(v.last_name).toBe('Jane Watson')
  })

  it('preserves casing in the source name verbatim', () => {
    const v = deriveVariables({ email: 'a@b.com', name: 'al SMITH' })
    expect(v.first_name).toBe('al')
    expect(v.last_name).toBe('SMITH')
  })

  it('falls back to a title-cased email local-part when no name is given', () => {
    expect(deriveVariables({ email: 'jane@example.com' }).first_name).toBe(
      'Jane'
    )
    expect(deriveVariables({ email: 'jane.doe@example.com' }).first_name).toBe(
      'Jane'
    )
    expect(deriveVariables({ email: 'JANE_DOE@example.com' }).first_name).toBe(
      'Jane'
    )
    expect(
      deriveVariables({ email: 'jane-doe+promo@example.com' }).first_name
    ).toBe('Jane')
  })

  it('does not invent a last_name from the email local-part', () => {
    expect('last_name' in deriveVariables({ email: 'jane.doe@example.com' })).toBe(
      false
    )
  })

  it('treats whitespace-only names as no name', () => {
    const v = deriveVariables({ email: 'jane@example.com', name: '   ' })
    expect(v.first_name).toBe('Jane')
    expect('last_name' in v).toBe(false)
  })

  it('ignores empty name parts so multiple spaces dont break first_name', () => {
    const v = deriveVariables({ email: 'a@b.com', name: '  Alice   Smith  ' })
    expect(v.first_name).toBe('Alice')
    expect(v.last_name).toBe('Smith')
  })

  it('handles an email with no local-part separator gracefully', () => {
    const v = deriveVariables({ email: 'jane@example.com' })
    expect(v.first_name).toBe('Jane')
  })
})
