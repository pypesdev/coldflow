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



# Email templates:

A curated, production-tested template pack lives in
[`templates/`](templates/) — sales, recruiting, partnership, warm-intro,
and follow-up. Each is plaintext, under ~120 words, with a single CTA and
deliverability notes. See [`templates/README.md`](templates/README.md) for
how to load one into a campaign.

# AI Personalization

Templates give you a starting point. Personalization is what turns a
starting point into a draft worth sending. Coldflow ships an opt-in helper
endpoint that takes a contact and a template and returns a personalized
variant — filling any remaining `{{vars}}` and adding 1–2 light touches
that acknowledge the recipient's role and reference their company
specifically.

**UI:** open `/dashboard/campaigns/new`, pick a template, then click
**Personalize with AI**. Provide a contact (name, company, role) and
review the line-by-line diff before applying.

**API:** `POST /api/personalize`

```
{
  "template_id": "sales_founder_direct",
  "contact": {
    "name": "Alex Chen",
    "company": "Acme Robotics",
    "role": "VP of Engineering",
    "product_name": "Coldflow",
    "sender_name": "Jared"
  }
}
```

Any extra string fields on `contact` become optional context — variables
like `{{product_name}}` are filled deterministically server-side before
the LLM is asked to add personalization touches. The response includes
`personalized_subject`, `personalized_body`, `used_variables`, and the
SDK `usage` object so you can track spend. Authenticated callers are
limited to one request every two seconds.

**Setup:** add `ANTHROPIC_API_KEY=…` to your `.env` (see `.env.example`).
Without a key the endpoint returns 503 and the UI shows a clean error.
Default model is `claude-haiku-4-5-20251001`; override with
`ANTHROPIC_PERSONALIZE_MODEL`.

# Move the needle TO-DO list:

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
