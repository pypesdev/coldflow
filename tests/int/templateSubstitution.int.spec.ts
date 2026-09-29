import { describe, expect, it } from 'vitest'
import { applyVariables } from '@/lib/templateSubstitution'

describe('applyVariables', () => {
  it('replaces a single placeholder', () => {
    expect(applyVariables('Hi {{first_name}}', { first_name: 'Alice' })).toBe(
      'Hi Alice'
    )
  })

  it('replaces multiple distinct placeholders in one pass', () => {
    expect(
      applyVariables('Hi {{first_name}} from {{company}}', {
        first_name: 'Alice',
        company: 'Acme',
      })
    ).toBe('Hi Alice from Acme')
  })

  it('replaces every occurrence of the same placeholder', () => {
    expect(
      applyVariables('{{first_name}} — yes, {{first_name}}', {
        first_name: 'Alice',
      })
    ).toBe('Alice — yes, Alice')
  })

  it('tolerates whitespace inside the braces', () => {
    expect(applyVariables('Hi {{ first_name }}', { first_name: 'Alice' })).toBe(
      'Hi Alice'
    )
    expect(
      applyVariables('Hi {{   first_name\t}}', { first_name: 'Alice' })
    ).toBe('Hi Alice')
  })

  it('leaves unknown placeholders untouched (safer than blank)', () => {
    expect(applyVariables('Hi {{first_name}} at {{company}}', { first_name: 'A' })).toBe(
      'Hi A at {{company}}'
    )
  })

  it('substitutes empty-string values explicitly (no fallback)', () => {
    expect(applyVariables('Hi {{first_name}}!', { first_name: '' })).toBe(
      'Hi !'
    )
  })

  it('does not interpret $ in replacement values as backreferences', () => {
    // The naive `.replace(regex, value)` path would treat `$&` etc. as
    // backreferences. Confirm we are robust to user-supplied dollar signs.
    expect(applyVariables('cost {{price}}', { price: '$5 + $&' })).toBe(
      'cost $5 + $&'
    )
    expect(applyVariables('{{x}} {{x}}', { x: '$1' })).toBe('$1 $1')
  })

  it('returns the input unchanged when there are no placeholders', () => {
    expect(applyVariables('plain text', { foo: 'bar' })).toBe('plain text')
    expect(applyVariables('plain text', {})).toBe('plain text')
  })

  it('returns the input unchanged when variables is null/undefined', () => {
    expect(applyVariables('Hi {{first_name}}', undefined)).toBe('Hi {{first_name}}')
    expect(applyVariables('Hi {{first_name}}', null)).toBe('Hi {{first_name}}')
  })

  it('returns the input unchanged for empty/null template', () => {
    expect(applyVariables('', { first_name: 'A' })).toBe('')
  })

  it('does not match single-brace placeholders', () => {
    expect(applyVariables('Hi {first_name}', { first_name: 'A' })).toBe(
      'Hi {first_name}'
    )
  })

  it('does not match malformed multi-line braces', () => {
    expect(
      applyVariables('Hi {{first_\nname}}', { 'first_\nname': 'X' })
    ).toBe('Hi {{first_\nname}}')
  })

  it('matches keys with dashes, dots, and digits', () => {
    expect(
      applyVariables('a {{first-name}} b {{co.name}} c {{x1}}', {
        'first-name': 'Al',
        'co.name': 'Acme',
        x1: '42',
      })
    ).toBe('a Al b Acme c 42')
  })

  it('does not invent values from the prototype chain', () => {
    expect(applyVariables('{{toString}}', {})).toBe('{{toString}}')
    expect(applyVariables('{{constructor}}', {})).toBe('{{constructor}}')
  })
})
