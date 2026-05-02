/**
 * Email template catalog.
 *
 * Templates use the same `{{variable}}` placeholder syntax as the campaigns
 * API (see src/app/api/campaigns/route.ts). The `variables` array on each
 * template lists every placeholder name found in `subject` or `body`.
 *
 * To add a template: append an entry below and ensure every `{{name}}` in
 * subject/body is listed in `variables`. The catalog test enforces this.
 */

export type TemplateCategory =
  | 'saas'
  | 'agency'
  | 'recruiting'
  | 'b2b'
  | 'founder'
  | 're_engagement'

export type EmailTemplate = {
  id: string
  name: string
  category: TemplateCategory
  description: string
  subject: string
  body: string
  variables: string[]
}

export const TEMPLATES: EmailTemplate[] = [
  {
    id: 'saas_onboarding',
    name: 'SaaS Onboarding',
    category: 'saas',
    description:
      'Warm welcome to a new signup that nudges them to the first activation step.',
    subject: 'Welcome to {{product_name}}, {{first_name}}',
    body: `Hi {{first_name}},

Thanks for signing up for {{product_name}}. Most teams get value in the first 10 minutes by doing one thing: {{first_action}}.

Want me to walk you through it on a quick call, or would a short loom be more useful?

Either way, reply here and I'll get it to you today.

— {{sender_name}}`,
    variables: ['first_name', 'product_name', 'first_action', 'sender_name'],
  },
  {
    id: 'agency_outreach',
    name: 'Agency Outreach',
    category: 'agency',
    description:
      'Cold outreach from an agency offering a specific service to a target prospect.',
    subject: 'Helping {{company}} with {{service_area}}',
    body: `Hi {{first_name}},

I run {{agency_name}} and we help {{target_segment}} like {{company}} with {{service_area}}. Recently we helped {{case_study_company}} {{case_study_outcome}}.

If it's worth 15 minutes to see whether we could do something similar for {{company}}, here's my calendar: {{calendar_link}}.

If not, no worries — appreciate you reading.

— {{sender_name}}`,
    variables: [
      'first_name',
      'company',
      'service_area',
      'agency_name',
      'target_segment',
      'case_study_company',
      'case_study_outcome',
      'calendar_link',
      'sender_name',
    ],
  },
  {
    id: 'recruiter_outbound',
    name: 'Recruiter Outbound',
    category: 'recruiting',
    description:
      'Outbound from a recruiter or hiring manager to a passive candidate.',
    subject: '{{role_title}} role at {{company}} — open to a chat?',
    body: `Hi {{first_name}},

I'm hiring a {{role_title}} at {{company}} and your background in {{candidate_skill}} stood out — especially your work at {{candidate_current_company}}.

Quick context: comp is {{comp_range}}, the team is {{team_size}}, and we're working on {{problem_focus}}.

Worth a 20-minute call this week to see if it's a fit? If now's not the right moment, I'm happy to keep in touch.

— {{sender_name}}`,
    variables: [
      'first_name',
      'role_title',
      'company',
      'candidate_skill',
      'candidate_current_company',
      'comp_range',
      'team_size',
      'problem_focus',
      'sender_name',
    ],
  },
  {
    id: 'b2b_warm_intro',
    name: 'B2B Warm Intro',
    category: 'b2b',
    description:
      'Mutual-connection intro to a prospect after a referral or shared thread.',
    subject: '{{mutual_contact}} suggested I reach out',
    body: `Hi {{first_name}},

{{mutual_contact}} mentioned you're thinking about {{problem_area}} at {{company}} and suggested we connect. We help teams ship {{solution_outcome}} without {{usual_friction}}.

Happy to send a 2-minute walkthrough video, or grab 15 minutes if that's easier: {{calendar_link}}.

— {{sender_name}}`,
    variables: [
      'first_name',
      'mutual_contact',
      'problem_area',
      'company',
      'solution_outcome',
      'usual_friction',
      'calendar_link',
      'sender_name',
    ],
  },
  {
    id: 'founder_to_founder',
    name: 'Founder to Founder',
    category: 'founder',
    description:
      'Personal note from a founder to a peer founder — peer tone, low ask.',
    subject: 'Quick one, {{first_name}}',
    body: `Hi {{first_name}},

Founder at {{my_company}} here. Saw what you're building at {{company}} and the {{specific_observation}} caught my eye — we ran into the exact same wall last year.

Would you be open to a 20-minute swap on {{topic}}? Happy to share what worked (and what burned us) in exchange for hearing how you're thinking about it.

No agenda beyond that.

— {{sender_name}}`,
    variables: [
      'first_name',
      'my_company',
      'company',
      'specific_observation',
      'topic',
      'sender_name',
    ],
  },
  {
    id: 're_engagement_silent_3day',
    name: 'Re-engagement (3-Day Silent)',
    category: 're_engagement',
    description:
      'Follow-up to a warm prospect who replied with interest, then went quiet for ~3 days.',
    subject: 'Re: {{previous_subject}}',
    body: `Hi {{first_name}},

Circling back on the thread below — last we spoke you mentioned {{stated_interest}} and I sent over {{thing_sent}}.

A few quick options to keep this moving:
1. 15-minute call this week: {{calendar_link}}
2. Async — reply with your top question and I'll record a Loom
3. Park it and I'll follow up in {{followup_window}}

Whatever's easiest.

— {{sender_name}}`,
    variables: [
      'first_name',
      'previous_subject',
      'stated_interest',
      'thing_sent',
      'calendar_link',
      'followup_window',
      'sender_name',
    ],
  },
]

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(PLACEHOLDER_REGEX)) {
    found.add(match[1])
  }
  return Array.from(found)
}

export function getTemplateById(id: string): EmailTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
