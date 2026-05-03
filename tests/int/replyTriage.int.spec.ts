import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import cases from '../triage/cases.json'
import {
  triageReply,
  triageReplyHeuristic,
  triageReplyLLM,
} from '@/lib/replyTriage'

const { messagesCreate } = vi.hoisted(() => ({ messagesCreate: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => {
  const Anthropic = vi.fn(() => ({
    messages: { create: messagesCreate },
  }))
  return { default: Anthropic }
})

const textResponse = (text: string) => ({
  content: [{ type: 'text', text }],
})

describe('triageReplyHeuristic', () => {
  it('classifies the labeled cases.json set with >= 80% accuracy', () => {
    let correct = 0
    const misses: { label: string; expected: string; got: string }[] = []
    for (const c of cases.cases) {
      const result = triageReplyHeuristic({ replyBody: c.body })
      if (result.intent === c.intent) correct++
      else misses.push({ label: c.label, expected: c.intent, got: result.intent })
    }
    const accuracy = correct / cases.cases.length
    if (accuracy < 0.8) {
      console.error('triage misses:', misses)
    }
    expect(accuracy).toBeGreaterThanOrEqual(0.8)
  })

  it('flags clear OOO autoresponders with empty suggested follow-up', () => {
    const result = triageReplyHeuristic({
      replyBody: 'I am out of the office until next week.',
    })
    expect(result.intent).toBe('out_of_office')
    expect(result.suggestedFollowup).toBe('')
  })

  it('addresses recipient by first name when provided', () => {
    const result = triageReplyHeuristic({
      replyBody: 'Send pricing for 50 seats.',
      recipientName: 'Pat Example',
    })
    expect(result.intent).toBe('interested')
    expect(result.suggestedFollowup).toMatch(/^Hi Pat,/)
  })

  it('produces a generic greeting when no name is provided', () => {
    const result = triageReplyHeuristic({
      replyBody: 'Send pricing.',
    })
    expect(result.suggestedFollowup).toMatch(/^Hi,/)
  })
})

describe('triageReplyLLM', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    messagesCreate.mockReset()
  })

  it('returns null when no API key is configured', async () => {
    const result = await triageReplyLLM({ replyBody: 'price?' })
    expect(result).toBeNull()
    expect(messagesCreate).not.toHaveBeenCalled()
  })

  it('parses a valid LLM response', async () => {
    messagesCreate.mockResolvedValue(
      textResponse(
        '{"intent":"interested","confidence":0.92,"suggested_followup":"Hi Pat, happy to share details."}'
      )
    )

    const result = await triageReplyLLM(
      { replyBody: 'price?' },
      { apiKey: 'sk-test' }
    )
    expect(result).toEqual({
      intent: 'interested',
      confidence: 0.92,
      suggestedFollowup: 'Hi Pat, happy to share details.',
      source: 'llm',
    })
  })

  it('tolerates ```json fences in the LLM response', async () => {
    messagesCreate.mockResolvedValue(
      textResponse(
        '```json\n{"intent":"objection","confidence":0.7,"suggested_followup":"x"}\n```'
      )
    )
    const result = await triageReplyLLM(
      { replyBody: 'no thanks' },
      { apiKey: 'sk-test' }
    )
    expect(result?.intent).toBe('objection')
  })

  it('returns null when the LLM returns garbage that cannot be parsed', async () => {
    messagesCreate.mockResolvedValue(textResponse('sorry, I cannot help'))
    const result = await triageReplyLLM(
      { replyBody: '...' },
      { apiKey: 'sk-test' }
    )
    expect(result).toBeNull()
  })

  it('returns null when the SDK throws', async () => {
    messagesCreate.mockRejectedValue(new Error('500 server error'))
    const result = await triageReplyLLM(
      { replyBody: '...' },
      { apiKey: 'sk-test' }
    )
    expect(result).toBeNull()
  })

  it('rejects unknown intent values', async () => {
    messagesCreate.mockResolvedValue(
      textResponse('{"intent":"happy","confidence":0.9,"suggested_followup":"x"}')
    )
    const result = await triageReplyLLM(
      { replyBody: '...' },
      { apiKey: 'sk-test' }
    )
    expect(result).toBeNull()
  })

  it('clamps confidence into [0, 1]', async () => {
    messagesCreate.mockResolvedValue(
      textResponse('{"intent":"interested","confidence":1.5,"suggested_followup":"x"}')
    )
    const result = await triageReplyLLM(
      { replyBody: 'p' },
      { apiKey: 'sk-test' }
    )
    expect(result?.confidence).toBe(1)
  })
})

describe('triageReply (end-to-end)', () => {
  beforeEach(() => {
    messagesCreate.mockReset()
  })
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
  })

  it('falls back to the heuristic when no API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const result = await triageReply({ replyBody: 'I am on vacation until next week.' })
    expect(result.intent).toBe('out_of_office')
    expect(result.source).toBe('heuristic')
  })

  it('falls back to the heuristic when the LLM call fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    messagesCreate.mockRejectedValue(new Error('network down'))
    const result = await triageReply({ replyBody: 'send pricing please' })
    expect(result.source).toBe('heuristic')
    expect(result.intent).toBe('interested')
  })

  it('uses LLM result when available', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    messagesCreate.mockResolvedValue(
      textResponse(
        '{"intent":"not_now","confidence":0.66,"suggested_followup":"talk later"}'
      )
    )
    const result = await triageReply({ replyBody: 'busy this quarter' })
    expect(result.source).toBe('llm')
    expect(result.intent).toBe('not_now')
    expect(result.suggestedFollowup).toBe('talk later')
  })
})
