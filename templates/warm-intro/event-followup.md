---
id: warm_intro_event_followup
name: Warm Intro — Event Follow-up
category: warm-intro
persona: Anyone who met a contact briefly at a conference, meetup, or dinner and wants to convert it to a real thread
use_case: Send within 48 hours of meeting. Reminds them of the specific moment, not the event in general. Highest reply rate of any warm template.
deliverability_notes: |
  Send from a real human address, not a sequencer-looking domain. Mention the
  specific conversation detail — generic "nice to meet you at X" gets archived.
  Keep under 100 words. No links unless they asked for one in person.
subject: Following up from {{event_name}}
variables:
  - first_name
  - event_name
  - specific_conversation_detail
  - thing_you_promised
  - next_step
  - sender_name
---

Hi {{first_name}},

Good chat at {{event_name}} — {{specific_conversation_detail}} stuck with me on the flight home.

Promised I'd send {{thing_you_promised}}. Here it is.

If {{next_step}} still makes sense, I'm around most of next week. Reply with a couple of times that work and I'll pick one.

— {{sender_name}}
