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
**Current Phase:** Phase 5 — Gameplay Testing (in progress)
**Last Updated:** 2026-02-28
**Last Session Summary:** Fixed the co-op header score affordance so its hover/focus treatment wraps the score text instead of stretching across the full grid column.
**Known Follow-up:** iOS Safari haptics are not firing on iPhone 16 Pro (iOS 26.2.1). Current `navigator.vibrate` + switch-input fallback has no reliable physical feedback; revisit during Phase 6 real-device testing.

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
- [x] Implement game state machine (`src/lib/gameState.ts`)
  - [x] States: setup → psychic-clue → human-guess → ai-bonus-guess → reveal → score → next-round → game-over
  - [x] Transitions between all states
- [x] 📦 `git add -A && git commit -m "[phase-1] game state machine"`
- [x] Implement scoring logic
  - [x] Bullseye (center zone): 4 pts
  - [x] Adjacent zone: 3 pts
  - [x] Outer zone: 2 pts
  - [x] Miss: 0 pts
  - [x] Bonus opposing guess correct: 1 pt
- [x] 📦 `git add -A && git commit -m "[phase-1] scoring logic"`
- [x] Implement round alternation (who is Psychic each round)
- [x] Implement win condition (first to 10 points)
- [x] 📦 `git add -A && git commit -m "[phase-1] round alternation + win condition"`
- [x] Write basic unit tests for scoring and state transitions
- [x] 📦 `git add -A && git commit -m "[phase-1] unit tests"`

**Phase 1 complete when:** Game state machine can run a full game in tests with no UI.

---

### Phase 2 — AI Integration
*Depends on Phase 0 (edge function) being complete.*

- [x] Define personality system prompt strings for Lumen, Sage, Flux
- [x] 📦 `git add -A && git commit -m "[phase-2] personality prompts"`
- [x] Implement `useAI` hook for all AI interactions
- [x] Implement clue generation call (Sonnet via `/api/ai`)
  - [x] Accepts: spectrum pair, target position, personality
  - [x] Returns: `{ clue: string, reasoning: string }`
  - [x] Handle API errors gracefully with fallback
- [x] 📦 `git add -A && git commit -m "[phase-2] clue generation"`
- [x] Implement dial placement call (Haiku via `/api/ai`)
  - [x] Accepts: spectrum pair, clue, personality
  - [x] Returns: `{ position: number, reasoning: string }`
- [x] 📦 `git add -A && git commit -m "[phase-2] dial placement"`
- [x] Test AI calls manually: verify Lumen/Sage/Flux produce meaningfully different outputs
- [x] Verify all responses parse correctly as JSON
- [x] Verify edge function is being called (not Anthropic directly)
- [x] 📦 `git add -A && git commit -m "[phase-2] AI integration verified"`

**Phase 2 complete when:** All three personalities generate clues and place the dial. Manually verified outputs feel distinct.

---

### Phase 3 — Dial UI
*Highest implementation risk. Build and validate in isolation before integrating.*

- [x] Build standalone `<Dial />` component in isolation (no game state wired)
- [x] 📦 `git add -A && git commit -m "[phase-3] dial component scaffold"`
- [x] Implement circular arc drag interaction — mouse
- [x] 📦 `git add -A && git commit -m "[phase-3] dial drag mouse"`
- [x] Implement circular arc drag interaction — touch (mobile)
- [x] 📦 `git add -A && git commit -m "[phase-3] dial drag touch"`
- [x] Drag position → 0–100 percentage math correct
- [x] Test on actual mobile device (not just browser devtools)
- [x] 📦 `git add -A && git commit -m "[phase-3] dial position math verified on device"`
- [x] Implement dial snap/easing on release
- [x] 📦 `git add -A && git commit -m "[phase-3] dial snap + easing"`
- [x] Implement reveal animation (target position animates in)
- [x] 📦 `git add -A && git commit -m "[phase-3] reveal animation"`
- [x] Wire dial to game state
- [x] 📦 `git add -A && git commit -m "[phase-3] dial wired to game state"`

**Phase 3 complete when:** Dial is draggable and accurate on both desktop and a real mobile device.

---

### Phase 4 — Full UI
*Depends on Phases 1–3.*

- [x] Splash screen with animated layered arcs (Framer Motion) — DM Serif Display title, animated arcs, warm beige canvas
- [x] 📦 `git add -A && git commit -m "[phase-4] splash screen"`
- [x] Setup screen — personality selection with descriptions — Lumen/Sage/Flux cards with accent colors
- [x] 📦 `git add -A && git commit -m "[phase-4] setup screen"`
- [x] Game screen layout
  - [x] Spectrum bar with gradient and concept labels
  - [x] Clue display area
  - [x] Score tracker (Human vs. AI)
  - [x] Round indicator
  - [x] Context-sensitive action area
- [x] 📦 `git add -A && git commit -m "[phase-4] game screen layout"`
- [x] AI reasoning panel (hidden, tap to reveal after round) — expandable accordion with chevron
- [x] 📦 `git add -A && git commit -m "[phase-4] AI reasoning panel"`
- [x] Round transition animation + score delta — fullscreen overlay with zone label, points, bonus
- [x] 📦 `git add -A && git commit -m "[phase-4] round transition"`
- [x] End screen — win/loss, score summary with serif typography
- [x] Share card generation (html2canvas) with Web Share API + clipboard fallback
- [x] 📦 `git add -A && git commit -m "[phase-4] end screen + share card"`
- [x] Apply full design system (colors, typography, spacing) — DM Sans + DM Serif Display, warm palette, custom Tailwind tokens (ink, warm, spectrum, personality colors)
- [x] 📦 committed with splash screen (foundational to all screens)
- [x] Mobile-first audit — test all screens at 390px width
- [x] Accessibility pass — focus states, contrast, touch targets
- [x] 📦 `git add -A && git commit -m "[phase-4] mobile audit + accessibility"`

**Phase 4 complete when:** Full game is playable end-to-end in browser and on mobile. Share card generates correctly.

---

### Phase 5 — Gameplay Testing
*Open-ended iteration phase. Do NOT skip to Phase 6 (Deploy) until gameplay feels solid.*

This phase is different from the others — it's not a linear checklist. We play-test the game, identify issues (gameplay feel, AI quality, UI rough edges, timing, animations, edge cases), log them as tasks below, fix them, and repeat. Tasks will be added and removed as we go.

**How this phase works:**
1. Play-test the full game loop (both as human psychic and with AI psychic)
2. Note anything that feels off — gameplay, UI, animations, AI behavior, timing
3. Add it as a task below with a clear description
4. Fix it, verify it in-game, commit
5. Repeat until the human says it's ready for deploy

**Important for all agents:** Do not auto-generate a big backlog of speculative tasks here. Tasks are added by the human during play-testing or collaboratively during a session. This is a "hang out and iterate" phase — stay responsive to what the human wants to work on next.

#### Active Tasks

*Tasks are added during play-testing. Keep this list clean — remove tasks that are no longer relevant rather than leaving them checked off forever.*

*No active tasks right now — add the next item during play-testing.*

#### Completed Tasks

*Move tasks here when done, with a brief note. Prune periodically.*

- [x] **Reload-safe routing + game session rehydration** — Added URL-based shell routing (`/` for splash, `/game` for mode/setup/game/end), app-shell snapshot persistence, and stable game-session snapshot restore in `GameScreen` so full reloads during theme edits return to the active flow instead of resetting to splash. Added typed snapshot storage tests in `sessionState`.
- [x] **Co-op reveal feedback + in-dial clue placement** — Moved clue labels/text into the dial card, replaced the separate co-op round summary card with a compact round-score pill rendered inside the dial, delayed co-op score updates to roll after the pill lands, simplified the post-reveal CTA to a standalone button, and nudged the light theme surface token warmer to match the revised board treatment.
- [x] **Psychic clue lock-in transition smoothing** — Added a scene transition trigger to `GameScreen` so pressing `Give Clue` animates the center gameplay stack with the same subtle horizontal fade (old left, new right), reducing the abrupt switch from clue entry to AI reading/placement.
- [x] **Next-round spectrum-first transition polish** — Updated `GameScreen` so `Next Round` advances to the new round state before clue generation, added a round-keyed horizontal fade transition (old left, new from right) with reduced-motion fallback, switched waiting copy to personality-specific wording (e.g., “Lumen is thinking of a clue...”), and rendered a static non-interactive dial shell (no hand/value/zones) while awaiting AI clues.
- [x] **In-game score thermometer modal** — Made the top-left co-op score in `ScoreBar` clickable during gameplay to open a modal containing `ScoreThermometer`, so players can check current score tier + marker at any time instead of waiting for the end screen.
- [x] **AI clue stability + rationale transparency** — Added a single-flight round-advance guard so repeated `Next Round` interactions cannot launch overlapping clue requests, disabled next-round buttons while AI clue generation is in-flight, and updated clue-generation prompt guidance so reasoning includes one rejected alternate clue and why the final clue was chosen.
- [x] **Co-op score thermometer end screen** — Added `ScoreThermometer` component with animated vertical fill bar showing all 8 co-op rating tiers (0–22+), integrated into `EndScreen` share card alongside the score number. Uses spectrum gradient fill, staggered tier label animations, and score marker line. Fits the warm/minimal design system.
- [x] **Clue endpoint-orientation hardening** — Strengthened clue-generation prompts to explicitly bind numeric scale to card concepts (`0 = left`, `100 = right`) and added anti-inversion reasoning guardrails so Sage/Lumen/Flux are less likely to describe taboo/acceptable-style endpoints backwards. Added regression coverage in `aiPrompts` tests.
- [x] **Dial + scoring-zone UI iteration** — Consolidated visual polish across dial geometry, scoring-zone rendering, and label placement; updated scoring thresholds to equal-width zone boundaries; and tightened SVG viewport/interaction mapping to match the play-test mock direction while preserving reveal flow and touch drag behavior.
- [x] **Dial UI refinement** — Reworked the dial into a wider 120° banana arc (`max-w-[350px]`) with visible target-centered score zones mapped to real scoring thresholds, added co-op center `3` + bonus icon (`4` in competitive), preserved percentage readout, and made zone visibility phase-aware (human psychic clue selection + reveal/results, hidden during active non-psychic guessing).
- [x] **Playtest cost controls + telemetry panel** — Added persisted playtest settings (`Haiku-only clues` toggle) surfaced through a bottom-left settings icon that opens a modal in setup and in-game screens, plus local AI usage/cost telemetry sourced from `/api/ai` usage metadata (current game + recent games grouped with expandable round lists, per-round haiku-vs-dual model indicator, stored-games aggregate totals, clear action, 10-game/100-round retention).
- [x] **Co-op mode overhaul** — Mode selection screen, 7-card deck, alternating psychic, single team score with rating chart, co-op scoring (bullseye 3pts + bonus card, adjacent 3pts, outer 2pts), updated ScoreBar/RoundTransition/EndScreen, cooperative AI prompt framing, 20 unit tests passing. Competitive scaffolding preserved for 1.0.
- [x] **Co-op pacing refactor** — Added manual reveal step after guesses, staged co-op flow to preserve guess→reveal rhythm, animated AI dial sweep for human-psychic rounds, replaced co-op fullscreen transition with inline summary card + explicit Next Round/See Results, and preserved competitive overlay behavior.
- [x] **Local AI proxy dev fix** — Added Vite dev middleware to forward `/api/ai` requests to `api/ai.ts` during `npm run dev`, preventing HTML fallback responses and restoring JSON AI responses for clue/dial calls in local play-tests.
- [x] **Local env loading for AI proxy** — Updated Vite config to load `.env` values into `process.env` in local dev so the `/api/ai` middleware can read `ANTHROPIC_API_KEY` and avoid “Server missing ANTHROPIC_API_KEY.”
- [x] **Dial reasoning consistency tuning** — Updated dial-placement prompts to explicitly define left/right numeric scale and require consistency between textual reasoning and numeric output to reduce contradictions like “rebellious” with right-leaning placement.

**Phase 5 complete when:** The human says the gameplay loop feels good and we're ready to ship.

---

### Phase 6 — Deploy
*Depends on Phase 5. Do NOT start until gameplay testing is complete.*

- [ ] Set `ANTHROPIC_API_KEY` in Vercel environment variables
- [ ] Deploy to Vercel
- [ ] Smoke test production build — full game, both player types
- [ ] Verify edge function works in production (check logs)
- [ ] 📦 `git add -A && git commit -m "[phase-6] production verified"`
- [ ] Test share card on iOS and Android
- [ ] Final mobile test on real device
- [ ] 📦 `git add -A && git commit -m "[phase-6] MVP complete 🎉"`

**Phase 6 complete when:** Live URL works end-to-end on real devices. Share card works.

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
| 2026-02-28 | Codex | Phase 5 | Fixed the co-op header score affordance in `ScoreBar` by preventing the score control from stretching across its grid column, so the interactive background now wraps the score text. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run build`. |
| 2026-02-28 | Codex | Phase 5 | Moved clue copy into the dial card, replaced the co-op reveal summary card with an inline round-score pill and delayed slot-roll score update, simplified the co-op post-reveal CTA, and warmed the base surface token. Verified with `npm run lint`, `npx tsc --noEmit`, `npm run test:game`, and `npm run build`. |
| 2026-02-24 | Codex | Phase 5 | Added reload-safe shell routing (`/` splash, `/game` gameplay flow) plus session-storage rehydration for app shell + in-progress game state so theme token edits no longer reset to splash. Added snapshot storage tests and verified with `npm run lint`, `npx tsc --noEmit`, `npm run test:game`, and `npm run build`. |
| 2026-02-23 | Codex | Phase 5 | Smoothed clue lock-in pacing by triggering the same subtle horizontal center-stack transition when the psychic submits `Give Clue`, reducing abrupt state swaps into AI reading/placement. Verified with `npm run lint`, `npx tsc --noEmit`, `npm run test:game`, and `npm run build`. |
| 2026-02-23 | Codex | Phase 5 | Implemented next-round transition polish: on continue, swap immediately to the next spectrum before AI clue fetch, animate the full center stack with a subtle horizontal fade (old-left/new-right) plus reduced-motion fallback, show personality-specific AI thinking copy, and display a static dial shell while awaiting the clue. Verified with `npm run lint`, `npx tsc --noEmit`, `npm run test:game`, and `npm run build`. |
| 2026-02-23 | Codex | Phase 5 | Added an in-game co-op score thermometer modal triggered by tapping the top-left score, reusing `ScoreThermometer` so players can view live score tier/marker during rounds. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-23 | Codex | Phase 5 | Fixed AI clue flicker from overlapping round-advance actions by adding a single-flight guard in `GameScreen`, disabling next-round controls while AI clue generation is active, and extending clue prompt guardrails to request one rejected alternate clue plus selection rationale in reasoning. Verified with `npm run lint`, `npx tsc --noEmit`, `npm run test:game`, and `npm run build`. |
| 2026-02-23 | Claude Code | Phase 5 | Added co-op score thermometer to EndScreen: `ScoreThermometer` component with animated spectrum-gradient fill bar, 8 tier labels (0–22+ pts), score marker, integrated into share card layout. Verified with `npx tsc --noEmit`. |
| 2026-02-23 | Codex | Phase 5 | Fixed clue endpoint-orientation drift observed in play-test reasoning by hardening clue prompt scale semantics (`0 = left endpoint`, `100 = right endpoint`) and adding anti-inversion guardrails plus regression tests in `aiPrompts`. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-23 | Codex | Phase 5 | Consolidated dial/scoring-zone UI iteration into one pass: refined zone visuals and label placement, switched scoring thresholds to equal-width zone boundaries, tightened arc-bound geometry and viewport cropping, and aligned dial interaction mapping with the cropped render region. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Switched the dial indicator to a needle-style hand (skinnier than the tapered paddle) to reduce overlap with scoring labels while preserving the single-hand/no-target-dot reveal model. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Replaced dot-based dial markers with a tapered paddle hand and removed the green reveal dot; reveal correctness is now communicated by wedge zones plus a single hand indicator for guess position. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Adjusted psychic preview dial presentation: removed black dial marker and percentage text during clue-picking to reduce visual noise while keeping marker/value in interactive guess flow. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Updated co-op reveal flow: scoring zones are hidden during pre-reveal review and now animate in only after pressing `Reveal Target`, with a short reveal animation window and disabled reveal button while resolving the round. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Iterated on dial visuals from play-test feedback: made dial sizing responsive on larger breakpoints, widened main game content width for desktop, and changed scoring-zone visuals to center-reaching sector wedges to better mirror the physical board. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Implemented dial UI refinement: 120° banana arc geometry, score-zone segment math from existing thresholds, visible psychic-preview/reveal zone rendering with competitive/co-op center labeling split, and interactive-only drag affordances. Updated dial math tests for arc boundaries and zone clipping. Verified with `npm run lint`, `npx tsc --noEmit`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Implemented playtest spend controls/telemetry: persisted Haiku-only clue mode, usage + estimated USD tracking from proxy metadata, bottom-left settings modal in setup/game, grouped rounds under game accordions (current open by default), per-round model-mode badges, and stored-games aggregate totals. Verified with `npm run lint` and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Added next active gameplay-testing task for dial UI refinement toward official 2-3-4-3-2 target spread, then prepared branch for merge into `main`. |
| 2026-02-22 | Codex | Phase 5 | Tuned dial-placement prompts for consistency: added explicit 0/50/100 left-center-right mapping and stronger reasoning-to-position alignment instructions to reduce contradictory Lumen outputs. Verified with `npm run lint`, `npm run build`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Added `.env` loading in Vite config for local server middleware so `/api/ai` can read `ANTHROPIC_API_KEY` during `npm run dev`; fixes local fallback clue/reasoning errors caused by missing server env vars. Verified with `npm run lint`, `npm run build`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Resolved local play-test AI proxy failures (`AI proxy response was not valid JSON`) by wiring a Vite dev `/api/ai` middleware to the edge handler and improving non-JSON proxy diagnostics in `useAI`. Verified with `npm run lint`, `npm run build`, and `npm run test:game`. |
| 2026-02-22 | Codex | Phase 5 | Implemented co-op pacing flow updates from play-test feedback: manual reveal step, inline co-op round summary with continue CTA, AI dial sweep animation before reveal, and competitive-only fullscreen transition. Verified with `npm run test:game`, `npm run build`, and `npm run lint`. |
| 2026-02-22 | Claude Code | Phase 5 | Completed co-op mode overhaul: ModeScreen, startCoopGame/submitTeamGuess/scoreCoopRound/getCoopRating state machine functions, GameScreen co-op branching, ScoreBar (single score + round X of Y), RoundTransition (bonus card message + running total), EndScreen (score + rating chart), cooperative AI prompt framing, 20 unit tests (12 new co-op + 8 existing competitive). TypeScript clean, build passes. |
| 2026-02-21 | Claude Code | Phase 4 | Completed mobile-first audit + accessibility pass: focus-visible ring styles, min-h-[44px] touch targets on bonus/retry buttons, ARIA attributes (role=slider on dial, aria-expanded on reasoning panel, aria-hidden on decorative elements, aria-label on clue input), contrast fixes (ink-faint #C4B9AB→#A89888, score-miss #94A3B8→#708296, score-outer #EAB308→#CA8A04). Verified full 2-round game flow at 390px. |
| 2026-02-21 | Claude Code | Phase 4 | Built all Phase 4 screens: SplashScreen (animated SVG arcs), SetupScreen (personality cards), GameScreen (full AI integration with stable-ref pattern to prevent infinite loops), ScoreBar, ReasoningPanel (accordion), RoundTransition (fullscreen overlay), EndScreen (html2canvas share card). Design system: DM Sans/DM Serif Display, warm palette, custom Tailwind tokens. |
| 2026-02-21 | Codex | Phase 3 | Investigated iOS Safari haptics on iPhone 16 Pro (iOS 26.2.1), confirmed no reliable Web API behavior in Safari for physical feedback, and logged a follow-up for Phase 4 mobile audit. |
| 2026-02-21 | Codex | Phase 3 | Built dial UI in isolation, implemented mouse/touch arc dragging with rotated orientation and mobile haptics, added snap/easing + reveal animation, and wired dial flow to the game state machine demo. |
| 2026-02-21 | Codex | Phase 2 | Completed AI integration in `useAI`, verified live Lumen/Sage/Flux outputs via `/api/ai`, updated model IDs to active Sonnet/Haiku 4.5 variants, and hardened JSON parsing for fenced model responses. |
| 2026-02-21 | Codex | Phase 1 | Implemented and tested game logic: typed entities, card loader + shuffle, deterministic state machine transitions, scoring, psychic alternation, and first-to-10 win condition. |
| 2026-02-21 | Codex | Phase 0 | Replaced in-memory edge rate limiting with Upstash Redis-backed limiting, updated `/api/ai.ts` fallback/misconfiguration behavior, refreshed tests, and documented new Upstash env vars/security notes. |
| 2026-02-21 | Codex | Phase 0 | Hardened `/api/ai.ts` with model/origin allowlists, stricter request bounds, and sanitized upstream error handling; added API hardening tests and test runner scripts. |
| 2026-02-21 | Codex | Phase 0 | Initialized Vite + React + TypeScript, configured Tailwind and Framer Motion, implemented `/api/ai.ts` with JSON validation + rate limiting, and completed required folder/public deck setup. |
| —    | —     | —     | —       |
