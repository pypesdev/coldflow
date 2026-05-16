/**
 * Live smoke test for the AI personalization endpoint.
 *
 * Skipped unless ANTHROPIC_API_KEY is set. Runs the full prompt against a real
 * Anthropic call using one of the HIR-103 markdown templates and asserts the
 * personalized subject + body have no leftover `{{vars}}` and that the SDK
 * usage object is populated so we can track spend.
 *
 *   ANTHROPIC_API_KEY=sk-... pnpm test:int
 */

import { describe, it, expect } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { extractPlaceholders } from '@/lib/templates/catalog'
import { getFileTemplateById } from '@/lib/templates/fileLoader'
import {
  buildPersonalizationPrompt,
  parseClaudeEnvelope,
  prefillTemplate,
} from '@/lib/templates/personalize'

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY
const SMOKE_TEMPLATE_ID =
  process.env.PERSONALIZE_SMOKE_TEMPLATE_ID || 'sales_founder_direct'
const MODEL =
  process.env.ANTHROPIC_PERSONALIZE_MODEL || 'claude-haiku-4-5-20251001'

describe('personalize smoke test', () => {
  it.skipIf(!HAS_KEY)(
    'returns a personalized variant with no leftover {{vars}} from a HIR-103 template',
    async () => {
      const template = await getFileTemplateById(SMOKE_TEMPLATE_ID)
      expect(template, `template ${SMOKE_TEMPLATE_ID} must exist`).toBeDefined()

      const contact = {
        name: 'Alex Chen',
        company: 'Acme Robotics',
        role: 'VP of Engineering',
        optional_context: {
          product_name: 'Coldflow',
          core_use_case: 'cold email automation',
          my_company: 'Coldflow',
          sender_name: 'Jared',
          mutual_contact: 'Sam',
          previous_subject: 'follow up',
          stated_interest: 'pricing',
          thing_sent: 'a one-pager',
          calendar_link: 'https://cal.example/jared',
          followup_window: '2 weeks',
          specific_observation: 'recent product launch',
          topic: 'GTM',
          agency_name: 'Coldflow Studio',
          target_segment: 'Series A SaaS',
          service_area: 'outbound',
          case_study_company: 'Foo Inc',
          case_study_outcome: '3x reply rates',
          candidate_skill: 'distributed systems',
          candidate_current_company: 'Globex',
          comp_range: '$200k–$240k',
          team_size: '8',
          problem_focus: 'platform reliability',
          problem_area: 'sender reputation',
          solution_outcome: 'higher inbox placement',
          usual_friction: 'slow setup',
          first_action: 'connect a mailbox',
          previous_topic: 'pricing',
        },
      }

      const prefilled = prefillTemplate(template!.subject, template!.body, contact)
      const prompt = buildPersonalizationPrompt({
        subject: prefilled.subject,
        body: prefilled.body,
        contact,
        remainingVariables: prefilled.remaining,
      })

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      expect(textBlock?.type).toBe('text')
      const envelope = parseClaudeEnvelope(
        (textBlock as { type: 'text'; text: string }).text,
      )

      expect(extractPlaceholders(envelope.personalized_subject)).toEqual([])
      expect(extractPlaceholders(envelope.personalized_body)).toEqual([])

      // Token usage must be present so the route can log spend.
      expect(response.usage.input_tokens).toBeGreaterThan(0)
      expect(response.usage.output_tokens).toBeGreaterThan(0)

      // Sanity: the personalized body should reference the company specifically
      // — that is the entire contract of the personalization touch.
      expect(envelope.personalized_body.toLowerCase()).toContain(
        contact.company.toLowerCase().split(' ')[0],
      )
    },
    30_000,
  )
})
