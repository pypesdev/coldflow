import { describe, expect, it, beforeEach } from 'vitest'
import {
  buildPersonalizationPrompt,
  parseClaudeEnvelope,
  personalizeRequestSchema,
  PersonalizationFormatError,
  prefillTemplate,
  MAX_OPTIONAL_CONTEXT_KEYS,
  MAX_OPTIONAL_CONTEXT_VALUE_LEN,
} from '@/lib/templates/personalize'
import {
  getFileTemplateById,
  listFileTemplates,
  __resetFileTemplateCacheForTests,
} from '@/lib/templates/fileLoader'
import { extractPlaceholders } from '@/lib/templates/catalog'
import { resolveTemplateById } from '@/lib/templates/resolver'
import { diffLines } from '@/lib/textDiff'

describe('prefillTemplate', () => {
  it('fills first_name, full_name, company, role from contact fields', () => {
    const result = prefillTemplate(
      'Hi {{first_name}} at {{company}}',
      'Hi {{first_name}}, saw you joined {{company}} as {{role}}. — {{sender_name}}',
      {
        name: 'Alex Chen',
        company: 'Acme',
        role: 'VP Engineering',
      },
    )
    expect(result.subject).toBe('Hi Alex at Acme')
    expect(result.body).toContain('Hi Alex,')
    expect(result.body).toContain('saw you joined Acme as VP Engineering')
    // sender_name not provided -> stays as a placeholder in `remaining`.
    expect(result.remaining).toEqual(['sender_name'])
    expect(result.filled.sort()).toEqual(['company', 'first_name', 'role'])
  })

  it('uses optional_context for non-canonical placeholders', () => {
    const result = prefillTemplate(
      'Quick {{topic}} note for {{company}}',
      'Hi {{first_name}}, want to chat about {{topic}}? — {{sender_name}}',
      {
        name: 'Sam',
        company: 'Globex',
        role: 'CTO',
        optional_context: { topic: 'inbox warming', sender_name: 'Jared' },
      },
    )
    expect(result.subject).toBe('Quick inbox warming note for Globex')
    expect(result.body).toBe('Hi Sam, want to chat about inbox warming? — Jared')
    expect(result.remaining).toEqual([])
  })

  it('contact fields override optional_context for canonical names', () => {
    const result = prefillTemplate(
      '{{first_name}} at {{company}}',
      '{{first_name}} {{role}}',
      {
        name: 'Real Name',
        company: 'Real Co',
        role: 'Real Role',
        optional_context: { first_name: 'Wrong', company: 'Wrong', role: 'Wrong' },
      },
    )
    expect(result.subject).toBe('Real at Real Co')
    expect(result.body).toBe('Real Real Role')
  })
})

describe('parseClaudeEnvelope', () => {
  it('parses a clean JSON object', () => {
    const env = parseClaudeEnvelope(
      JSON.stringify({
        personalized_subject: 'Hi Alex',
        personalized_body: 'Body',
      }),
    )
    expect(env.personalized_subject).toBe('Hi Alex')
    expect(env.personalized_body).toBe('Body')
  })

  it('strips a single ```json fenced block', () => {
    const env = parseClaudeEnvelope(
      '```json\n' +
        JSON.stringify({
          personalized_subject: 'S',
          personalized_body: 'B',
          personalization_notes: 'n',
        }) +
        '\n```',
    )
    expect(env.personalized_subject).toBe('S')
    expect(env.personalization_notes).toBe('n')
  })

  it('throws PersonalizationFormatError on bad JSON', () => {
    expect(() => parseClaudeEnvelope('not json {')).toThrow(
      PersonalizationFormatError,
    )
  })

  it('throws when keys are missing', () => {
    expect(() =>
      parseClaudeEnvelope(JSON.stringify({ personalized_subject: 'only' })),
    ).toThrow(PersonalizationFormatError)
  })
})

describe('buildPersonalizationPrompt', () => {
  it('lists remaining placeholders explicitly so the model fills them', () => {
    const { user } = buildPersonalizationPrompt({
      subject: 'Hi {{first_name}}',
      body: '{{first_name}} at {{company}} — {{sender_name}}',
      contact: { name: 'A', company: 'C', role: 'R' },
      remainingVariables: ['sender_name'],
    })
    expect(user).toContain('{{sender_name}}')
  })

  it('says (none) when no remaining placeholders', () => {
    const { user } = buildPersonalizationPrompt({
      subject: 'plain',
      body: 'plain',
      contact: { name: 'A', company: 'C', role: 'R' },
      remainingVariables: [],
    })
    expect(user).toContain('(none')
  })

  it('system prompt instructs the model to treat contact fields as untrusted data', () => {
    const { system } = buildPersonalizationPrompt({
      subject: 's',
      body: 'b',
      contact: { name: 'A', company: 'C', role: 'R' },
      remainingVariables: [],
    })
    // Contact-field prompt-injection guard — the model must not follow
    // instructions embedded in attacker-controlled fields like company name.
    expect(system).toMatch(/untrusted data/i)
    expect(system).toMatch(/never follow instructions/i)
  })
})

describe('personalizeRequestSchema', () => {
  const baseContact = { name: 'A', company: 'C', role: 'R' }

  it('accepts a minimal contact', () => {
    const r = personalizeRequestSchema.safeParse({
      template_id: 't',
      contact: baseContact,
    })
    expect(r.success).toBe(true)
  })

  it('accepts up to MAX_OPTIONAL_CONTEXT_KEYS extra fields', () => {
    const contact: Record<string, string> = { ...baseContact }
    for (let i = 0; i < MAX_OPTIONAL_CONTEXT_KEYS; i++) contact[`k${i}`] = 'v'
    const r = personalizeRequestSchema.safeParse({
      template_id: 't',
      contact,
    })
    expect(r.success).toBe(true)
  })

  it('rejects more than MAX_OPTIONAL_CONTEXT_KEYS extra fields', () => {
    const contact: Record<string, string> = { ...baseContact }
    for (let i = 0; i < MAX_OPTIONAL_CONTEXT_KEYS + 1; i++) contact[`k${i}`] = 'v'
    const r = personalizeRequestSchema.safeParse({
      template_id: 't',
      contact,
    })
    expect(r.success).toBe(false)
  })

  it('rejects optional_context values longer than the per-value cap', () => {
    const r = personalizeRequestSchema.safeParse({
      template_id: 't',
      contact: { ...baseContact, big: 'x'.repeat(MAX_OPTIONAL_CONTEXT_VALUE_LEN + 1) },
    })
    expect(r.success).toBe(false)
  })
})

describe('file template loader', () => {
  beforeEach(() => __resetFileTemplateCacheForTests())

  it('parses every HIR-103 markdown template into a normalized shape', async () => {
    const templates = await listFileTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(10)
    for (const t of templates) {
      expect(t.id.length).toBeGreaterThan(0)
      expect(t.subject.length).toBeGreaterThan(0)
      expect(t.body.length).toBeGreaterThan(0)
      // Variables must cover every placeholder in subject and body.
      const placeholders = new Set([
        ...extractPlaceholders(t.subject),
        ...extractPlaceholders(t.body),
      ])
      for (const p of placeholders) {
        expect(t.variables, `${t.id} missing ${p}`).toContain(p)
      }
    }
  })

  it('returns undefined for unknown ids', async () => {
    expect(await getFileTemplateById('nope')).toBeUndefined()
  })

  it('resolveTemplateById finds catalog ids and file ids', async () => {
    expect((await resolveTemplateById('saas_onboarding'))?.id).toBe(
      'saas_onboarding',
    )
    expect((await resolveTemplateById('sales_founder_direct'))?.id).toBe(
      'sales_founder_direct',
    )
    expect(await resolveTemplateById('does-not-exist')).toBeUndefined()
  })

  it('after prefilling a HIR-103 template with full optional_context, no {{vars}} remain', async () => {
    const template = await getFileTemplateById('sales_founder_direct')
    expect(template).toBeDefined()
    const optional_context: Record<string, string> = {}
    for (const v of template!.variables) {
      // Provide a stand-in for every declared variable so the deterministic
      // server-side fill leaves nothing for the model to clean up.
      optional_context[v] = `<${v}>`
    }
    const result = prefillTemplate(template!.subject, template!.body, {
      name: 'Alex Chen',
      company: 'Acme',
      role: 'VP Engineering',
      optional_context,
    })
    expect(extractPlaceholders(result.subject)).toEqual([])
    expect(extractPlaceholders(result.body)).toEqual([])
  })
})

describe('diffLines', () => {
  it('marks identical inputs as all same', () => {
    const ops = diffLines('a\nb\nc', 'a\nb\nc')
    expect(ops.every((o) => o.kind === 'same')).toBe(true)
  })

  it('detects added and removed lines', () => {
    const ops = diffLines('a\nb', 'a\nc\nb')
    const kinds = ops.map((o) => o.kind)
    expect(kinds).toContain('add')
    expect(kinds.filter((k) => k === 'same').length).toBe(2)
  })
})
