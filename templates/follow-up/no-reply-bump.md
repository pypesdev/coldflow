---
id: follow_up_no_reply_bump
name: Follow-up — No-Reply Bump
category: follow-up
persona: Anyone whose first cold email got opened but no reply, 4–7 days later
use_case: Single follow-up to a non-replier. Shorter than the first send, with a softer ask designed to surface "wrong person / wrong time" rather than push for a meeting.
deliverability_notes: |
  Send as a Reply-All to the original thread (Re: subject), not a new thread —
  Gmail groups it and reply rates roughly 2x. Don't repeat the original pitch;
  call out the silence and offer an out. Avoid "just bumping this up", "did you
  see my last email" — both read as pushy. Under 80 words.
subject: "Re: {{previous_subject}}"
variables:
  - first_name
  - previous_subject
  - original_topic
  - sender_name
---

Hi {{first_name}},

Following up on the thread below — figured I'd give you an out rather than chase.

A one-line reply works:

1. "Yes, send more" — and I'll send the short version
2. "Wrong person" — and I'll stop and find the right one
3. "Not now, ask me in {{original_topic}} months" — and I'll set a reminder

Whichever it is, no offense taken. Easier for both of us than a third email.

— {{sender_name}}
