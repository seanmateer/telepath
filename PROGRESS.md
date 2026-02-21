# PROGRESS.md
*This file must be read at the start of every agent session and updated after completing each task. It is the source of truth for project state across all agents and context windows — Claude Code, Codex, Cursor, or any other tool working on this repo.*

---

## Instructions for Any Agent

1. **At session start:** Read this file and `telepath-project-plan.md` in full before writing any code. Identify the current phase and the next uncompleted task.
2. **Before starting a task:** Note it as in-progress (add a comment or update status above if your tool supports it).
3. **After completing a task:** Check it off, then **immediately run the commit command shown** — do not batch multiple tasks into one commit.
4. **If you hit a blocker:** Mark it `🚫 Blocked`, log it in the Blockers Log below, and stop. Do not silently work around it or skip ahead.
5. **Never mark a task done without verifying end-to-end** — run the dev server, test the feature as a user would, check mobile viewport.
6. **At session end:** Add a row to the Session Log before stopping. If mid-task, commit with a `[wip]` prefix and describe what's in progress.
7. **Scope discipline:** Do not build anything outside the current milestone. 1.0 and 2.0 tasks are listed for reference only — do not touch them during MVP.

---

## Current Status

**Active Milestone:** MVP
**Current Phase:** Phase 1 — Game Logic (in progress)
**Last Updated:** 2026-02-21
**Last Session Summary:** Started Phase 1 by defining core game entity TypeScript types and updating initial game-state shape.

---

## MVP Phases & Tasks

### Phase 0 — Project Scaffolding
*Must be completed before any other phase.*

- [x] Initialize Vite + React + TypeScript project
- [x] 📦 `git add -A && git commit -m "[phase-0] project scaffold"`
- [x] Set up Tailwind CSS
- [x] 📦 `git add -A && git commit -m "[phase-0] tailwind setup"`
- [x] Set up Framer Motion
- [x] Create `.env.example` with all required env vars documented
- [x] 📦 `git add -A && git commit -m "[phase-0] framer motion + env.example"`
- [x] Create `vercel.json` with edge function routing config
- [x] Create `/api/ai.ts` Vercel Edge Function (**do this before any AI calls**)
- [x] Verify edge function proxies correctly to Anthropic API
- [x] Add basic rate limiting to edge function (max requests per IP)
- [x] 📦 `git add -A && git commit -m "[phase-0] vercel edge function + rate limiting"`
- [x] Copy `spectrum-deck.json` into `public/`
- [x] Set up project folder structure per `AGENTS.md`
- [x] 📦 `git add -A && git commit -m "[phase-0] folder structure + spectrum deck"`
- [x] Harden `/api/ai.ts` with model allowlisting, origin allowlisting, request bounds, and sanitized upstream errors
- [x] 📦 `git add -A && git commit -m "[phase-0] harden edge proxy"`
- [x] Add hardening tests for `/api/ai.ts` request validation, origin enforcement, and rate limiting
- [x] 📦 `git add -A && git commit -m "[phase-0] edge proxy hardening tests"`
- [x] Replace in-memory edge rate limiter with Upstash Redis-backed rate limiting
- [x] Update edge proxy tests and security/env documentation for Upstash rate limiting

**Phase 0 complete when:** Dev server runs, edge function responds, folder structure matches AGENTS.md spec.

---

### Phase 1 — Game Logic
*No UI required. Pure state machine and data.*

- [x] Define TypeScript types for all game entities (GameState, Round, Team, Card, Personality, etc.)
- [x] 📦 `git add -A && git commit -m "[phase-1] game types"`
- [x] Implement spectrum card loader (shuffle 80-card deck on game start)
- [x] 📦 `git add -A && git commit -m "[phase-1] card loader + shuffle"`
- [ ] Implement game state machine (`src/lib/gameState.ts`)
  - [x] States: setup → psychic-clue → human-guess → ai-bonus-guess → reveal → score → next-round → game-over
  - [x] Transitions between all states
- [x] 📦 `git add -A && git commit -m "[phase-1] game state machine"`
- [ ] Implement scoring logic
  - [x] Bullseye (center zone): 4 pts
  - [x] Adjacent zone: 3 pts
  - [x] Outer zone: 2 pts
  - [x] Miss: 0 pts
  - [x] Bonus opposing guess correct: 1 pt
- [x] 📦 `git add -A && git commit -m "[phase-1] scoring logic"`
- [ ] Implement round alternation (who is Psychic each round)
- [ ] Implement win condition (first to 10 points)
- [ ] 📦 `git add -A && git commit -m "[phase-1] round alternation + win condition"`
- [ ] Write basic unit tests for scoring and state transitions
- [ ] 📦 `git add -A && git commit -m "[phase-1] unit tests"`

**Phase 1 complete when:** Game state machine can run a full game in tests with no UI.

---

### Phase 2 — AI Integration
*Depends on Phase 0 (edge function) being complete.*

- [ ] Define personality system prompt strings for Lumen, Sage, Flux
- [ ] 📦 `git add -A && git commit -m "[phase-2] personality prompts"`
- [ ] Implement `useAI` hook for all AI interactions
- [ ] Implement clue generation call (Sonnet via `/api/ai`)
  - [ ] Accepts: spectrum pair, target position, personality
  - [ ] Returns: `{ clue: string, reasoning: string }`
  - [ ] Handle API errors gracefully with fallback
- [ ] 📦 `git add -A && git commit -m "[phase-2] clue generation"`
- [ ] Implement dial placement call (Haiku via `/api/ai`)
  - [ ] Accepts: spectrum pair, clue, personality
  - [ ] Returns: `{ position: number, reasoning: string }`
- [ ] 📦 `git add -A && git commit -m "[phase-2] dial placement"`
- [ ] Test AI calls manually: verify Lumen/Sage/Flux produce meaningfully different outputs
- [ ] Verify all responses parse correctly as JSON
- [ ] Verify edge function is being called (not Anthropic directly)
- [ ] 📦 `git add -A && git commit -m "[phase-2] AI integration verified"`

**Phase 2 complete when:** All three personalities generate clues and place the dial. Manually verified outputs feel distinct.

---

### Phase 3 — Dial UI
*Highest implementation risk. Build and validate in isolation before integrating.*

- [ ] Build standalone `<Dial />` component in isolation (no game state wired)
- [ ] 📦 `git add -A && git commit -m "[phase-3] dial component scaffold"`
- [ ] Implement circular arc drag interaction — mouse
- [ ] 📦 `git add -A && git commit -m "[phase-3] dial drag mouse"`
- [ ] Implement circular arc drag interaction — touch (mobile)
- [ ] 📦 `git add -A && git commit -m "[phase-3] dial drag touch"`
- [ ] Drag position → 0–100 percentage math correct
- [ ] Test on actual mobile device (not just browser devtools)
- [ ] 📦 `git add -A && git commit -m "[phase-3] dial position math verified on device"`
- [ ] Implement dial snap/easing on release
- [ ] 📦 `git add -A && git commit -m "[phase-3] dial snap + easing"`
- [ ] Implement reveal animation (target position animates in)
- [ ] 📦 `git add -A && git commit -m "[phase-3] reveal animation"`
- [ ] Wire dial to game state
- [ ] 📦 `git add -A && git commit -m "[phase-3] dial wired to game state"`

**Phase 3 complete when:** Dial is draggable and accurate on both desktop and a real mobile device.

---

### Phase 4 — Full UI
*Depends on Phases 1–3.*

- [ ] Splash screen with animated layered arcs (Framer Motion)
- [ ] 📦 `git add -A && git commit -m "[phase-4] splash screen"`
- [ ] Setup screen — personality selection with descriptions
- [ ] 📦 `git add -A && git commit -m "[phase-4] setup screen"`
- [ ] Game screen layout
  - [ ] Spectrum bar with gradient and concept labels
  - [ ] Clue display area
  - [ ] Score tracker (Human vs. AI)
  - [ ] Round indicator
  - [ ] Context-sensitive action area
- [ ] 📦 `git add -A && git commit -m "[phase-4] game screen layout"`
- [ ] AI reasoning panel (hidden, tap to reveal after round)
- [ ] 📦 `git add -A && git commit -m "[phase-4] AI reasoning panel"`
- [ ] Round transition animation + score delta
- [ ] 📦 `git add -A && git commit -m "[phase-4] round transition"`
- [ ] End screen — win/loss, score summary
- [ ] Share card generation (html2canvas or equivalent)
- [ ] 📦 `git add -A && git commit -m "[phase-4] end screen + share card"`
- [ ] Apply full design system (colors, typography, spacing)
- [ ] 📦 `git add -A && git commit -m "[phase-4] design system"`
- [ ] Mobile-first audit — test all screens at 390px width
- [ ] Accessibility pass — focus states, contrast, touch targets
- [ ] 📦 `git add -A && git commit -m "[phase-4] mobile audit + accessibility"`

**Phase 4 complete when:** Full game is playable end-to-end in browser and on mobile. Share card generates correctly.

---

### Phase 5 — Deploy
*Depends on Phase 4.*

- [ ] Set `ANTHROPIC_API_KEY` in Vercel environment variables
- [ ] Deploy to Vercel
- [ ] Smoke test production build — full game, both player types
- [ ] Verify edge function works in production (check logs)
- [ ] 📦 `git add -A && git commit -m "[phase-5] production verified"`
- [ ] Test share card on iOS and Android
- [ ] Final mobile test on real device
- [ ] 📦 `git add -A && git commit -m "[phase-5] MVP complete 🎉"`

**Phase 5 complete when:** Live URL works end-to-end on real devices. Share card works.

---

## 1.0 Tasks (Do Not Start Until MVP is Live)

- [ ] Supabase project setup
- [ ] Room creation + unique code generation
- [ ] Room join via URL
- [ ] Real-time dial sync (Supabase Realtime)
- [ ] Room state persistence + 24hr expiry
- [ ] Human team display names
- [ ] LLM-generated themed card packs (curated before shipping)
- [ ] Pack selection at setup

---

## 2.0 Tasks (Do Not Start Until 1.0 is Live)

- [ ] Player-generated packs (real-time LLM generation from prompt)
- [ ] Pack sharing via URL
- [ ] Configurable scoring (points target or round count)

---

## Blockers Log

*Log blockers here. Never silently work around one.*

| Date | Agent | Task | Blocker | Resolution |
|------|-------|------|---------|------------|
| —    | —     | —    | —       | —          |

---

## Session Log

*One row per session. Most recent first. Include which agent was used.*

| Date | Agent | Phase | Summary |
|------|-------|-------|---------|
| 2026-02-21 | Codex | Phase 0 | Replaced in-memory edge rate limiting with Upstash Redis-backed limiting, updated `/api/ai.ts` fallback/misconfiguration behavior, refreshed tests, and documented new Upstash env vars/security notes. |
| 2026-02-21 | Codex | Phase 0 | Hardened `/api/ai.ts` with model/origin allowlists, stricter request bounds, and sanitized upstream error handling; added API hardening tests and test runner scripts. |
| 2026-02-21 | Codex | Phase 0 | Initialized Vite + React + TypeScript, configured Tailwind and Framer Motion, implemented `/api/ai.ts` with JSON validation + rate limiting, and completed required folder/public deck setup. |
| —    | —     | —     | —       |
