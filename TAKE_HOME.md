# Coldflow — Take-Home Assignment

Welcome, and thanks for taking the time. This exercise mirrors the real day-to-day
of working on Coldflow: clone the repo, pick up open GitHub issues, ship a PR.

## What you're building

Coldflow is an open-source cold email tool (Next.js 15 + Payload CMS 3 + Postgres).
You'll resolve **two open issues** in a single pull request against `main`:

1. **[#4 — actually be able to send emails](https://github.com/pypesdev/coldflow/issues/4)**
   > Right now the Google OAuth config is too confusing to get it wired up where it works for sending emails.

2. **[#5 — CF-1: Eazy — be able to upload a contact list](https://github.com/pypesdev/coldflow/issues/5)**
   > The list of leads, that we are sequencing outreach to, should have the ability to upload a CSV.

## Time budget

Aim for **~4–6 hours**. If you hit the ceiling, stop and document what's left in
the PR description — we'd rather see a clean, honest cut-off than a rushed
finish.

## Setup

Prereqs: **Node 20+**, **pnpm**, **Docker + Docker CLI**.

**Install pnpm** (pick one):
```bash
corepack enable && corepack prepare pnpm@latest --activate   # easiest if you have Node 20+
# or
npm install -g pnpm
# or (macOS)
brew install pnpm
```

**Install Docker:**
- **macOS / Windows:** install [Docker Desktop](https://www.docker.com/products/docker-desktop/) — includes the Docker CLI and Compose. Launch it once so the daemon is running.
- **Linux:** follow the [Docker Engine install guide](https://docs.docker.com/engine/install/) for your distro, then `sudo systemctl start docker`.

Verify both are working:
```bash
pnpm -v && docker info > /dev/null && echo "ready"
```

**Run the app:**
```bash
git clone https://github.com/pypesdev/coldflow.git
cd coldflow
cp .env.example .env   # fill in the values you need (see issue #4)
pnpm i
docker compose up -d db
pnpm dev
```

Open `http://localhost:3000`.

CI runs on every PR (`.github/workflows/ci.yml`):
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm test:int`

Your PR must be green.

## Scope

### Issue #4 — Google OAuth → sending works end-to-end

A new contributor should be able to clone the repo, follow the README, connect
their Google account, and successfully send a test email from a campaign.

Expectations:
- Document the **exact** Google Cloud setup (OAuth client type, redirect URIs,
  scopes, consent screen state) in the README or a `docs/` page. Screenshots
  welcome.
- Make the required `.env` keys obvious in `.env.example` with comments on
  where each value comes from.
- Fix any code-level friction you hit (bad error messages, missing scopes,
  broken redirect handling, token refresh, etc.). Root-cause it — don't paper
  over it.
- Verify the send path actually works against a real Gmail account before
  declaring done.

### Issue #5 — CSV upload for contact lists

Users should be able to upload a CSV of leads and have those leads attached to
a campaign for sequencing.

Expectations:
- A clear UI entry point on the leads/contacts surface (wherever it belongs
  given existing patterns).
- Reasonable column mapping: at minimum `email`, `first_name`, `last_name`.
  Bonus for arbitrary columns flowing through to template variables.
- Validate rows: skip/report invalid emails, dedupe within the file and against
  existing contacts.
- Give the user feedback: how many imported, how many skipped, and why.
- Handle a 1k-row file without falling over. You don't need to design for 1M.

## Ground rules

- **One PR**, targeting `main`. Title: `take-home: <your name>`.
- Write code in the style of the existing codebase. Don't restructure things
  that aren't in your way.
- Tests where they add real signal (parsing logic, validation, OAuth token
  handling). Don't pad coverage.
- Keep commits coherent — we read history.
- If you make a non-obvious tradeoff, call it out in the PR description.

## What we evaluate

| Area | What good looks like |
|---|---|
| **Problem framing** | You understood what the issue actually meant, not just the literal words |
| **Code quality** | Reads cleanly, fits the codebase, no dead code or speculative abstractions |
| **Correctness** | The send works. The CSV import works. Edge cases considered |
| **Developer experience** | A teammate could pick up your changes tomorrow without asking you questions |
| **Communication** | PR description tells us what, why, and what you'd do next |

## Submitting

1. Push your branch to a fork.
2. Open a PR against `pypesdev/coldflow:main`.
3. In the PR description include:
   - A short summary per issue
   - How you tested (the actual steps, including a screenshot or short clip of
     a send going through and a CSV import succeeding)
   - Anything you'd do with another day
4. Reply to the email thread with the PR link.

Questions during the exercise are fine — ask. We'd rather unblock you than
watch you guess.

Good luck.
