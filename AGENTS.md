# AGENTS.md
*Universal agent instruction file. Supported by Claude Code, Cursor, Codex, Gemini, Jules, and others.*

> **Claude Code users:** Also read `CLAUDE.md` for CC-specific session management and native Tasks instructions.

---

## File Sync Note

`AGENTS.md` is the **canonical source of truth** for all universal project context. `CLAUDE.md` extends it with Claude Code-specific instructions only — it must never duplicate content from here.

**If you update any of the following in one file, update the other to match:**
- Tech stack
- Project structure
- Environment variables
- Non-negotiable rules
- Milestone scope boundaries

When in doubt, `AGENTS.md` wins for universal content. `CLAUDE.md` wins only for CC-specific session behavior.

---

## Project Overview

A web-based game called **Telepath** — an adaptation of the Wavelength board game. In solo play (MVP), a human and an AI with a distinct personality cooperate as teammates, alternating as psychic. In multiplayer (1.0), humans compete against the AI in shared rooms, starting with one human team collaborating in real time. Built as a public project — code quality and architecture decisions should reflect that.

Full design context: `telepath-project-plan.md`  
Progress tracking: `PROGRESS.md`

At the start of every session, read `PROGRESS.md` and `telepath-project-plan.md` before implementing tasks.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| AI — Clue generation | Anthropic Claude Sonnet (via `/api/ai` proxy) |
| AI — Dial placement + reasoning | Anthropic Claude Haiku (via `/api/ai` proxy) |
| API Layer | Vercel Functions (`/api/ai.ts` proxy today, `/api/rooms/*` authority in 1.0) |
| Hosting | Vercel |
| Backend (1.0 only) | Supabase (room persistence + presence + broadcast) |

---

## Project Structure

```
/
├── AGENTS.md                    ← Universal agent instructions (this file)
├── CLAUDE.md                    ← Claude Code-specific extensions
├── PROGRESS.md                  ← Task tracking — read at session start
├── telepath-project-plan.md     ← Full design doc
├── public/
│   └── spectrum-deck.json       ← 80 core spectrum card pairs
├── src/
│   ├── components/
│   ├── hooks/
│   │   └── useAI.ts             ← All AI interaction logic
│   ├── lib/
│   │   └── gameState.ts         ← Game state machine
│   ├── types/
│   │   └── game.ts              ← All game-related TypeScript types
│   └── main.tsx
├── api/
│   ├── ai.ts                    ← Vercel Edge Function — build this first
│   └── rooms/                   ← 1.0 authoritative room routes (`create`, `join`, `action`)
├── .env.example                 ← Document env vars here, never commit .env
└── vercel.json
```

---

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Lint
npm run lint --fix   # Lint and auto-fix
npx tsc --noEmit     # Type check
```

---

## 🚨 Non-Negotiable Rules

1. **Never expose `ANTHROPIC_API_KEY` client-side.** All AI calls must proxy through `/api/ai.ts`. Never call `api.anthropic.com` directly from the frontend.
2. **Never commit `.env` or any file containing real secrets.** Only `.env.example` with placeholder values goes in the repo.
3. **All AI responses must be typed and parsed as JSON.** Every prompt must instruct the model to respond only with valid JSON. Wrap all parsing in try/catch with typed fallbacks. Never parse freeform AI text.
4. **TypeScript throughout.** No `any` types without an explicit comment explaining why.
5. **Mobile-first.** Build for 390px width first, then scale up.
6. **Build `/api/ai.ts` before any other AI-related code.** The edge function is a prerequisite — do not wire up AI calls without it in place.

---

## Architecture

- All Anthropic API calls go through `/api/ai.ts` — never call Anthropic directly from frontend
- Game state lives in `src/lib/gameState.ts` as a single state machine — avoid scattered `useState` for game flow
- All AI interaction logic lives in `src/hooks/useAI.ts` — not inline in components
- Spectrum card data is static JSON at `public/spectrum-deck.json` — no API call needed
- All AI responses are structured JSON
- In 1.0, Supabase handles room persistence, presence, and broadcast; Vercel room routes stay authoritative for create/join/action and AI-triggered turns
- Multiplayer clients consume sanitized public room state only; hidden round state remains server-side until reveal

**Edge function structure:**
```ts
// /api/ai.ts
import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  // Validate request
  // Call Anthropic API using process.env.ANTHROPIC_API_KEY
  // Return structured response
}
```

---

## AI Personalities

Three personalities, each with a distinct system prompt affecting clue style and dial placement. Personality is passed as a parameter to the edge function and injected into the system prompt — never hardcode personality behavior in the frontend.

| Name | Style | Clue tendency | Dial placement |
|---|---|---|---|
| 🔵 Lumen | Literal | Functional, direct properties | Conservative, near center |
| 🟠 Sage | Abstract | Metaphorical, emotional associations | Confident, wider variance |
| 🔴 Flux | Chaotic | Unpredictable mix | High variance, occasionally overconfident |

---

## Game Rules

### Game Modes

**Co-op Mode (MVP — solo play):**
- Human and AI are teammates, not opponents
- They alternate as psychic each round (random first psychic)
- When AI is psychic: AI gives clue → human places dial
- When human is psychic: human gives clue → AI places dial
- 7 cards per game. Game ends when deck is empty
- Bullseye = 3 pts + draw a bonus card (extra round!)
- Adjacent = 3 pts, Outer = 2 pts, Miss = 0 pts
- No left/right bonus guess phase (no opposing team)
- End-of-game score rated on a chart (0–3 terrible → 22+ psychic for real)
- Based on the official Wavelength cooperative mode rules

**Competitive Mode (1.0 — multiplayer):**
- First cut: one shared human team vs. AI on a fixed board with live named cursors
- First to 10 points wins
- Each round: active team's Psychic gives a clue → their team places the dial → opposing team makes a bonus left/right guess for 1pt
- Any connected human may drag the shared dial, but only the host may trigger phase-changing actions
- Human-team psychic rotates automatically by join order in the first release
- Scoring: Bullseye 4 pts, Adjacent 3 pts, Outer 2 pts, Miss 0 pts, Bonus guess correct 1 pt
- Shared pan/zoom camera movement and two-human-team rooms are explicitly out of scope for the first 1.0 cut

---

## Spectrum Card Deck

- Located at `public/spectrum-deck.json`
- 80 original pairs — do not replace or modify without discussion
- Loaded client-side as static JSON
- Shuffle on game start

---

## Environment Variables

```
ANTHROPIC_API_KEY=        # Required. Server-side only. Never expose client-side.
UPSTASH_REDIS_REST_URL=   # Required in production for distributed edge rate limiting.
UPSTASH_REDIS_REST_TOKEN= # Required in production for distributed edge rate limiting.
VITE_SUPABASE_URL=        # Required in 1.0+. Client-safe Supabase project URL.
VITE_SUPABASE_ANON_KEY=   # Required in 1.0+. Client-safe Supabase anon key.
SUPABASE_SERVICE_ROLE_KEY=# Required in 1.0+. Server-side only for room APIs.
```

Document any new env vars in `.env.example` as they are added. Never add real values to `.env.example`.

---

## Code Conventions

- Named exports preferred over default exports (except pages/routes)
- Component files: PascalCase (`DialComponent.tsx`)
- Hook files: camelCase with `use` prefix (`useGameState.ts`)
- No inline styles — Tailwind classes only
- Prefer small focused components — if a component exceeds ~150 lines, consider splitting

---

## Frontend Design Reference

Read before writing any UI code: https://github.com/anthropics/anthropic-quickstarts/blob/main/assets/frontend-design/SKILL.md

Key design principles:
- Background: warm light beige (`#FAF7F2`)
- Spectrum gradient: amber → coral → rose
- Typography: Inter or Geist
- Animations: purposeful, not decorative
- Dial interaction must work reliably on touch — validate early in isolation

---

## Security Notes

- `ANTHROPIC_API_KEY` and `UPSTASH_REDIS_REST_TOKEN` are server-side secrets only (Vercel env vars)
- `UPSTASH_REDIS_REST_URL` is server-side configuration for rate limiting
- Rate limiting is implemented in `/api/ai.ts` — do not remove it
- No user authentication in MVP — no PII collected or stored
- Supabase (1.0): anon key is safe client-side; service role key is not

---

## Milestone Scope

**MVP (shipped):** Solo co-op play (human + AI teammates). Mode selection screen with competitive disabled. No multiplayer, no Supabase, no user accounts.
**1.0 (current):** Human multiplayer rooms + Supabase + competitive mode enabled. First cut is one human team vs. AI on a fixed board with live named cursors, host-controlled round commits, and no shared pan/zoom camera.
**2.0:** Player-generated card packs. Do not build during 1.0.

Do not build ahead of the current milestone without explicit instruction.
