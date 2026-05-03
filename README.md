![Coldflow](COLDFLOW_README.png)

# Goal: Make all aspects of cold outbound functional, transparent, and accessible

- infra/domain setup
- list creation
- enrichment
- research
- intent signals
- ai personalization
- sequencing

# To run locally:
- download pnpm
- download docker and cli
- copy the example.env into .env with `cp .env.example .env`
- `pnpm i`
- `pnpm dev`
- navigate to `localhost:3000`


# MVP features:

✅ - enter a domain and see SPF / dkim / dmarc records
   <sub>Want this without spinning up coldflow? Use the standalone CLI:
   [`npx dmarc-doctor yourdomain.com`](https://github.com/pypesdev/dmarc-doctor) —
   same checker, zero deps, prints colored verdicts plus 'how to fix'.</sub>
- connect google smtp accounts
   <sub>Mail landing in spam from a self-hosted relay? Diagnose the transport
   layer in 30s with [`npx smtp-warmer test --host smtp.example.com --port 587 --user me@example.com`](https://github.com/pypesdev/smtp-warmer)
   — TLS handshake, AUTH+RCPT sandbox (no mail sent), DNSBL reputation,
   reverse-DNS alignment. Zero deps, zero API keys, composite 0–10 score.</sub>
- upload a csv of contacts
- Create a single-step email sequence with basic personalization ({first_name}).
- Send the emails (with a strict, safe sending limit).
- See a basic dashboard showing "sent" and "replied."
- Silent-reply follow-up: when a prospect replies asking for pricing/details
  (or any question) and then goes silent, automatically schedule a short
  follow-up 3 days later. The follow-up cancels itself if the prospect
  replies again before it sends. See **Pending follow-ups** on the dashboard.



# Templates

Starter cold-email templates live in [`/templates`](./templates). Each file is
a single ICP × purpose combination — pick the closest match, swap the variables,
adapt the body in your own voice. Bodies are 80–140 words, plain text, no
buzzword soup.

The current set:

| File | ICP | Purpose |
| --- | --- | --- |
| `devtools-cold-intro.json` | Engineering manager / staff engineer | Book a 15-min product demo |
| `b2b-saas-cold-intro.json` | Head of RevOps / Sales Ops | Land a 20-min discovery call |
| `agency-services-pitch.json` | Founder / marketing lead | Open a paid-engagement conversation |
| `recruiter-candidate-outreach.json` | Senior / staff engineer | Book an exploratory call |
| `fundraising-warm-intro.json` | Friend / advisor (forwardable to investor) | Get a warm intro to a specific VC |
| `partnership-pitch.json` | Partnerships lead at adjacent product | Explore co-marketing or integration |
| `customer-research-interview.json` | Anyone in your ICP | Book a 20-min discovery interview |
| `lapsed-lead-revive.json` | Prospect silent 30+ days | Re-open the conversation |

## Template JSON shape

```json
{
  "id": "devtools-cold-intro",
  "name": "Devtools cold intro",
  "icp": "Engineering manager / staff engineer at series A–C startups",
  "purpose": "Book a 15-min product demo",
  "subjectLines": ["...", "..."],
  "body": "Hi {{firstName}}, ...",
  "variables": [
    {"key": "firstName", "required": true},
    {"key": "company", "required": true},
    {"key": "specificObservation", "required": false, "note": "Something specific you noticed about their product or recent post."}
  ],
  "notes": "Why this template works, when to use it, what to swap.",
  "license": "MIT"
}
```

Fields:

- `id` — kebab-case identifier; matches the filename.
- `name` — human-readable label for pickers.
- `icp` — who this is aimed at.
- `purpose` — the single outcome the email is trying to produce.
- `subjectLines` — 2–3 variants. Test before scaling.
- `body` — plain text, `{{var}}` placeholders, no HTML.
- `variables` — every placeholder used in `subjectLines` or `body`. `required: true` means the email shouldn't go without it; `required: false` means it's worth using if you have it. Use the optional `note` field to coach senders on what makes a good value.
- `notes` — when to use, when not to, what tends to break.
- `license` — usage license. All starters ship as MIT.

## How to use a template

Today, templates are content-only. Pick one, copy the `body` and one of the
`subjectLines` into the compose UI, and substitute your variables by hand.

Wiring `templates/` directly into the compose UI as a picker is a follow-up —
see the parent plan in HIR-105, or open an issue if you want it sooner.

## Contributing a template

PRs welcome. Keep new templates aligned with the conventions:

- One ICP × purpose per file.
- 80–140 word body, plain text, no jargon.
- 2–3 subject line variants.
- Document every variable, including a `note` for non-obvious ones.
- `notes` should explain *why* the template works and what to watch out for.
- All starters in this repo are MIT-licensed.



# Move the needle TO-DO list:

- [x] Templates for popular email needs i.e "onboarding for SaaS" — see `/templates`
- [ ] Integration with GHL / N8N

# Content TO-DO list:

- [ ] "How to Achieve Perfect Cold Email Deliverability with a Self-Hosted Tool"

- [ ] "The Complete Guide to Building a Custom Lead Scoring Model with Coldflow"

- [ ] "Why Your Shared IP is Killing Your Campaigns (And How to Take Back
      Control)"

- [ ] Listicles - Top 10 lists. I actually tested different platforms, used real
      screenshots and update them frequently.

- [ ] Guest posts - Find tech-related/ B2B / SaaS websites and pitch them
      content. Make sure there's context. For ex. one of my posts is on a
      Woocommerce site, so my article is how X can help grow your ecommerce
      store.

- [ ] Existing listicles - If you search for "Best X", there are dozens of
      articles already ranking in Google. Reach out to them and ask to be
      featured. Some will ignore you, some will ask you to pay, but eventually -
      some will say yes. I've ended up on 10+ existing sites.

- [ ] Original research - Launch a Startup report get it picked up by some big
      media outlets. I try to link to the research 2-3 times in either my own
      content or in guest articles.

- [ ] I use a variation of the anchor "According to research by X Tool". This is
      the strongest way to build authority.

- [ ] Keep content fresh. Never more than 6 months old. Each month, I updated
      content that is close to being more 6 months+ and rewrite the intro and
      include 1-2 internal links to new content.

# Ideas:

The real trouble starts only after the prospect replies. this is the part that
every tool completely ignores. and this is the part that matters the most.

When someone has already replied... they’re warm. they’ve shown interest. they
asked a question. they said yes send details. they requested pricing. whatever
it is. and then sometimes they go silent for 3 or 4 days. sometimes even 7. this
is where the follow up actually decides the deal. these are the follow ups that
convert. not the cold ones.
