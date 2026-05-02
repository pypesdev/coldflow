import { describe, expect, it } from 'vitest'
import {
  TEMPLATES,
  extractPlaceholders,
  getTemplateById,
  type EmailTemplate,
} from '@/lib/templates/catalog'

const REQUIRED_TEMPLATE_IDS = [
  'saas_onboarding',
  'agency_outreach',
  'recruiter_outbound',
  'b2b_warm_intro',
  'founder_to_founder',
  're_engagement_silent_3day',
] as const

describe('email template catalog', () => {
  it('parses and exports a non-empty template list', () => {
    expect(Array.isArray(TEMPLATES)).toBe(true)
    expect(TEMPLATES.length).toBeGreaterThan(0)
  })

  it('seeds every required template from HIR-75', () => {
    const ids = TEMPLATES.map((t) => t.id)
    for (const required of REQUIRED_TEMPLATE_IDS) {
      expect(ids).toContain(required)
    }
  })

  it('uses unique template ids', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('declares variables that exactly match placeholders in subject + body', () => {
    for (const template of TEMPLATES) {
      const placeholdersInSubject = extractPlaceholders(template.subject)
      const placeholdersInBody = extractPlaceholders(template.body)
      const allPlaceholders = new Set([
        ...placeholdersInSubject,
        ...placeholdersInBody,
      ])
      const declared = new Set(template.variables)

      // No undeclared placeholder in the template text.
      for (const placeholder of allPlaceholders) {
        expect(
          declared.has(placeholder),
          `template "${template.id}" uses {{${placeholder}}} but does not declare it in variables`,
        ).toBe(true)
      }

      // No declared variable that is unused in the text.
      for (const declaredVar of declared) {
        expect(
          allPlaceholders.has(declaredVar),
          `template "${template.id}" declares variable "${declaredVar}" but it is not used in subject or body`,
        ).toBe(true)
      }
    }
  })

  it('has non-empty fields for every template', () => {
    for (const template of TEMPLATES) {
      const t: EmailTemplate = template
      expect(t.id.length).toBeGreaterThan(0)
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.category.length).toBeGreaterThan(0)
      expect(t.subject.length).toBeGreaterThan(0)
      expect(t.body.length).toBeGreaterThan(0)
      expect(Array.isArray(t.variables)).toBe(true)
    }
  })

  it('getTemplateById returns the matching template or undefined', () => {
    expect(getTemplateById('saas_onboarding')?.id).toBe('saas_onboarding')
    expect(getTemplateById('does-not-exist')).toBeUndefined()
  })
})

describe('extractPlaceholders', () => {
  it('returns each unique placeholder name once', () => {
    const text = 'Hi {{first_name}}, your {{first_name}} order at {{company}}.'
    expect(extractPlaceholders(text).sort()).toEqual(['company', 'first_name'])
  })

  it('handles whitespace inside braces', () => {
    expect(extractPlaceholders('Hello {{ first_name }}!')).toEqual([
      'first_name',
    ])
  })

  it('returns an empty array when there are no placeholders', () => {
    expect(extractPlaceholders('plain text with no variables')).toEqual([])
  })

  it('ignores single-brace tokens', () => {
    expect(extractPlaceholders('hello {first_name}')).toEqual([])
  })
})
