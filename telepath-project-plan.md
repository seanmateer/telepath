# Telepath – Project Plan
*A web-based adaptation of the Wavelength board game*
*Project name: **Telepath** — a psychic-themed spin on Wavelength*

---

## ⚠️ Open Decisions — Remaining

- [ ] **Room link sharing format** — For 1.0 multiplayer: short code (e.g. `WXYZ`) + URL, or UUID-based URL only?

---

## ✅ Resolved Decisions

- **Game modes:** MVP uses co-op mode (human + AI teammates, official Wavelength co-op rules). Competitive mode (humans vs AI) deferred to 1.0 with multiplayer. Mode selection screen shows both options with competitive disabled.
- **Solo co-op rules:** 7 cards per game, alternating psychic (random first), bullseye = 3 pts + bonus card, end-of-game score rated on chart.
- **Bonus guess:** Not used in co-op mode (no opposing team). Kept in codebase for competitive mode in 1.0.
- **Spectrum deck:** LLM-generated pairs. 80-card core deck shipped as static JSON (see `spectrum-deck.json`). Additional LLM-generated packs in 1.0, player-generated in 2.0.
- **Multiplayer:** MVP is solo only. 1.0 adds human multiplayer with websockets — priority 1 after working MVP.
- **Scoring:** Co-op: score rated on chart at game end. Competitive (1.0): first to 10 points. Configurable scoring planned for post-1.0.
- **AI explanation:** Yes — shown after reveal, hidden behind a tap. Both for player interest and prompt/model tuning purposes.
- **Hosting:** Vercel (frontend, free tier), Supabase (DB + realtime for 1.0, free tier). Effectively $0 hosting cost. Anthropic API is the only variable cost.
- **AI personalities:** 3 for MVP — Lumen (literal), Sage (abstract), Flux (chaotic).
- **Dial interaction:** Validated — circular arc drag on touch works. Implemented in Phase 3.

---

## Attribution

Telepath is inspired by [Wavelength](https://www.cmyk.games/collections/games/products/wavelength), a social guessing game where two teams compete to read each other's minds. This project is not affiliated with or endorsed by the designers or publisher. If you enjoy Telepath, consider [buying the physical Wavelength game](https://www.cmyk.games/collections/games/products/wavelength).

---

## Reference Material

- **Physical game:** https://www.cmyk.games/collections/games/products/wavelength
- **Official rules:** https://tesera.ru/images/items/1666746/Wavelength_rules.pdf 
- **Official app:** https://www.wavelength.zone
- **Fan versions:**
  - https://longwave.web.app
  - https://mikeck1.github.io
- **Physical box design:** Warm layered color gradient, concentric arcs, dial metaphor — use as visual inspiration, not direct copy.

---

## Concept

A web-based adaptation of Wavelength where a human plays with an AI partner. In solo play (MVP), the human and AI cooperate as teammates — alternating as the psychic who gives clues while the other reads their mind and places the dial. In multiplayer (1.0), human teams compete against the AI in competitive mode.

The AI has a distinct personality that affects its clue style and dial placement. The core experience is trying to read how an LLM thinks — and having it try to read you back.

---

## Milestone Overview

| Milestone | Scope | Goal |
|---|---|---|
| **MVP** | Solo co-op with AI, static deck, core loop | Validate the AI partner concept |
| **1.0** | + Competitive mode, human multiplayer rooms, LLM-generated card packs | Make it a real shareable game |
| **2.0** | + Player-generated packs, pack sharing, scoring options | Community and replayability |

---

## MVP

*Solo co-op mode. You & AI as teammates. Validate the AI partner experience.*

### Scope
- Solo co-op mode: human + AI are teammates (choice of 3 AI personalities)
- Mode selection screen: co-op enabled, competitive disabled ("Coming in 1.0")
- Full game loop: spectrum card draw → psychic gives clue → partner places dial → reveal → score → next round
- Human and AI alternate as psychic each round (random first psychic)
- 7 cards per game; bullseye grants bonus card (extra round)
- End-of-game score rated on chart (0–3 terrible → 22+ psychic for real)
- Post-reveal AI reasoning panel (hidden behind tap)
- Static 80-card core spectrum deck (`spectrum-deck.json`) — 7 drawn per game
- Animated splash screen
- Share card on game end (score + rating + AI personality)
- Mobile-first responsive design

### What's Excluded from MVP
- Competitive mode (scaffolding exists, disabled in UI)
- Human multiplayer
- LLM-generated card packs
- User accounts or persistent stats
- Custom scoring options

### Tech Stack — MVP

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| AI | Anthropic API (Sonnet for clue gen, Haiku for dial placement + reasoning) |
| Hosting | Vercel (free tier) |
| Backend | None — pure frontend for MVP |

> MVP has no server-side state. Game runs entirely client-side. Supabase introduced in 1.0.

### AI Design — MVP

**3 Personalities:**

- 🔵 **Lumen** *(Literal)* — Precise, functional, convergent. Clues based on direct properties. Guesses conservatively. Best for new players.
- 🟠 **Sage** *(Abstract)* — Poetic, metaphorical, associative. Leads with emotional connections. Harder to read.
- 🔴 **Flux** *(Chaotic)* — Unpredictable. Mixes literal and abstract. Occasionally overconfident. Highest variance.

**API split:**
- Clue generation → Claude Sonnet (richer cultural/semantic range)
- Dial placement + reasoning → Claude Haiku (simpler task, cost-sensitive)
- All responses as structured JSON

**Clue generation prompt structure:**
```
You are {personality_name}, an AI playing a spectrum guessing game.
The spectrum is: [{left_concept}] ←——→ [{right_concept}]
The hidden target is at position {target_position}% from the left (0 = far left, 100 = far right).
Your personality: {personality_description}
Give a clue (1–3 words) hinting at this position without naming either concept directly.
Also provide a brief reasoning explanation for after the reveal.
Respond only as JSON: { "clue": "...", "reasoning": "..." }
```

**Dial placement prompt structure:**
```
You are {personality_name}, an AI playing a spectrum guessing game.
The spectrum is: [{left_concept}] ←——→ [{right_concept}]
The human's clue was: "{clue}"
Estimate where on the spectrum this clue points (0 = far left, 100 = far right).
Your personality: {personality_description}
Respond only as JSON: { "position": <number 0-100>, "reasoning": "..." }
```

**Estimated cost per full round:** < $0.005 at current Sonnet/Haiku pricing.

### Screens & UX Flow — MVP

**1. Splash**
- Animated warm layered color arcs (Framer Motion, slow parallax)
- Title + tagline
- Single CTA: Play
- Minimal — no clutter

**2. Mode Selection**
- Co-op card: enabled, clickable — "You & AI are teammates"
- Competitive card: disabled — "Coming in 1.0"

**3. Setup**
- Choose AI personality with short description
- Start game

**4. Game Screen**
- Spectrum bar — warm gradient, left/right concept labels
- Dial — draggable arc, touch-optimized
- Clue display — prominent, centered above spectrum
- Score tracker — single team score, round X of Y
- Context-sensitive action area:
  - AI psychic rounds: "Waiting for AI..." → clue appears → human drags dial → "Lock Guess"
  - Human psychic rounds: target visible + clue input → "Give Clue" → AI places dial
- After reveal: target animates in, score updates, AI reasoning panel (tap to expand)

**5. Round Transition**
- Zone label (Bullseye! / Close! / Almost / Miss)
- Points earned + running total
- Bonus card message on bullseye
- Next Round / See Results button

**6. End Screen**
- Total score prominently displayed
- Rating from co-op chart (e.g., "You're on the same wavelength!")
- Rounds played, personality partnered with
- Shareable card (score + rating + personality)
- Play Again / Change Personality

### Design System

- **Background:** Warm light beige — `#FAF7F2`
- **Spectrum gradient:** Amber → coral → rose (inspired by physical game warmth, original palette)
- **Typography:** Inter or Geist — clean geometric sans
- **Personality accent colors:** Lumen → cool blue, Sage → warm amber, Flux → coral red
- **Dial:** Minimal, satisfying drag. Circular arc math on touch — validate early.
- **Animations:** Purposeful — splash parallax, dial easing, reveal arc animation

### Spectrum Deck — MVP

80 original pairs in `spectrum-deck.json`. Covers a range of:
- Concrete/sensory: Cold/Hot, Soft/Hard, Dark/Bright
- Behavioral: Impulsive/Deliberate, Humble/Arrogant, Calm/Chaotic
- Cultural/evaluative: Overrated/Underrated, Lowbrow/Highbrow, Niche/Universal
- Abstract: Literal/Metaphorical, Cerebral/Visceral, Grounded/Dreamy

*See `spectrum-deck.json` for full list.*

### MVP Build Phases

**Phase 1 — Game logic**
- Spectrum card data + shuffle
- Game state machine (whose turn, round, scores)
- Scoring logic including bonus guess

**Phase 2 — AI integration**
- Anthropic API setup
- Personality prompt system
- Clue generation + dial placement calls
- JSON response parsing + error handling

**Phase 3 — Dial UI**
- Circular arc drag interaction (mouse + touch)
- Position → percentage math
- Reveal animation

**Phase 4 — Full UI + polish**
- All screens implemented
- Design system applied
- Animations
- Share card generation (html2canvas or similar)

**Phase 5 — Deploy**
- Vercel deployment
- Environment variable setup for API key
- Basic rate limiting consideration (API key exposure on client — see note below)

> ⚠️ **API Key Note:** For MVP, the Anthropic API key will be exposed client-side unless a thin serverless function proxies the calls. Recommend a simple Vercel Edge Function as the API proxy even in MVP — prevents key exposure and enables basic rate limiting.

---

## 1.0

*Competitive mode + multiplayer rooms + LLM-generated card packs. Priority 1 after working MVP.*

### Added Scope
- **Competitive mode enabled** — humans vs. AI, first to 10 points, bonus guess mechanic (code scaffolding already exists from MVP)
- Human multiplayer via shareable room link (humans share one team vs. AI)
- Real-time dial sync across all human players (they see each other's live position)
- Room creation with unique code + URL
- No account required — display name only
- Room owner selects AI personality; room expires after 24hr inactivity
- **LLM-generated card packs** — themed packs generated via Claude and curated before shipping (e.g. "Food & Taste", "Tech & Culture", "Emotions")
- Pack selection at game setup

### Tech Additions — 1.0

| Layer | Addition |
|---|---|
| Backend | Supabase (room state, realtime presence, dial sync) |
| Realtime | Supabase Realtime (websockets) |
| Auth | None — anonymous display names only |

### Multiplayer Room Logic
- Owner generates room → unique 4-letter code + URL (e.g. `wavelength.app/room/WXYZ`)
- Participants join via link, enter display name
- All humans on one team; AI auto-assigned as opponent
- Real-time dial position broadcast as human players drag
- Room state: waiting → in-game → complete
- Expires 24hr after last activity

### LLM Pack Generation Process (1.0)
1. Prompt Claude to generate 20 spectrum pairs on a given theme
2. Human review + curation pass
3. Ship as additional static JSON packs alongside core deck
4. Player selects pack(s) at game setup (all, core only, themed)

Example themed packs: Food & Taste, Tech & Culture, Emotions & Feelings, Nature, Work & Career, Movies & TV.

---

## 2.0

*Player-generated packs, pack sharing, scoring options.*

### Added Scope
- **Player-generated packs** — player enters a theme prompt, LLM generates a pack in real time, player reviews before playing
- **Pack sharing** — share a generated pack via link; others can play or fork it
- **Scoring options** — configurable points target or round count at game setup
- **Stats / history** — optional: track wins, favorite personalities, best rounds (requires auth consideration)

### Player Pack Generation Flow
- Input: free text prompt ("make a pack about cooking techniques")
- LLM generates 15–20 pairs, shown to player for review
- Player can delete pairs they don't like before saving
- Pack gets a shareable ID/URL
- Optional: community pack browser (most played, highest rated)

---

## Out of Scope (All Milestones)
- Native mobile app
- Spectator mode
- Leaderboards
- In-app voice/video chat
- Monetization
