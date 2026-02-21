# Telepath – Project Plan
*Humans vs. AI adaptation of the Wavelength board game*
*Project name: **Telepath** — a psychic-themed spin on Wavelength*

---

## ⚠️ Open Decisions — Remaining

- [ ] **Bonus guess mechanic** — Keep the physical game's opposing-team bonus guess (left/right of dial for 1pt), or simplify? With a 2-team structure (humans vs. AI) this still works naturally — decide before building scoring logic.
- [ ] **AI explanation UI** — Confirmed: yes, show reasoning hidden behind a click/tap after reveal. Decide: single expandable panel, or a persistent "AI thought" drawer?
- [ ] **Dial interaction prototype** — Highest-risk UI piece. Validate circular drag-on-arc touch interaction before committing to full build.
- [ ] **Room link sharing format** — For 1.0 multiplayer: short code (e.g. `WXYZ`) + URL, or UUID-based URL only?

---

## ✅ Resolved Decisions

- **Spectrum deck:** LLM-generated pairs. 80-card core deck shipped as static JSON (see `spectrum-deck.json`). Additional LLM-generated packs in 1.0, player-generated in 2.0.
- **Multiplayer:** MVP is solo only. 1.0 adds human multiplayer with websockets — priority 1 after working MVP.
- **Scoring:** First to 10 points. Configurable scoring planned for post-1.0.
- **AI explanation:** Yes — shown after reveal, hidden behind a tap. Both for player interest and prompt/model tuning purposes.
- **Hosting:** Vercel (frontend, free tier), Supabase (DB + realtime for 1.0, free tier). Effectively $0 hosting cost. Anthropic API is the only variable cost.
- **AI personalities:** 3 for MVP — Lumen (literal), Sage (abstract), Flux (chaotic).

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

A web-based adaptation of Wavelength with a meaningful twist: **it's always Humans vs. AI**. One team is the human player(s), the other is a single AI opponent with a distinct personality. The AI acts as a full team of one — giving clues when it's the psychic, placing the dial as the opposing guesser when humans are the psychic.

This makes the AI a genuine rival rather than a background system, keeps API costs low, and creates the game's most interesting moment: trying to read how an LLM thinks.

---

## Milestone Overview

| Milestone | Scope | Goal |
|---|---|---|
| **MVP** | Solo vs. AI, static deck, core loop | Validate the AI opponent concept |
| **1.0** | + Human multiplayer rooms, LLM-generated card packs | Make it a real shareable game |
| **2.0** | + Player-generated packs, pack sharing, scoring options | Community and replayability |

---

## MVP

*Solo only. You vs. AI. Validate the core loop and AI opponent experience.*

### Scope
- Single player vs. one AI opponent (choice of 3 personalities)
- Full game loop: spectrum card draw → clue → dial placement → reveal → score → next round
- First to 10 points wins
- AI as psychic: generates clue via API, human places dial
- AI as guesser: human gives clue, AI places dial as opposing bonus guess
- Post-reveal AI reasoning panel (hidden behind tap)
- Static 80-card core spectrum deck (`spectrum-deck.json`)
- Animated splash screen
- Share card on game end (score + AI personality faced)
- Mobile-first responsive design

### What's Excluded from MVP
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

**2. Setup**
- Choose AI personality with short description
- Start game

**3. Game Screen**
- Spectrum bar — warm gradient, left/right concept labels
- Dial — draggable arc, touch-optimized (highest implementation risk)
- Clue display — prominent, centered above spectrum
- Score tracker — Human vs. AI, subtle top bar
- Round indicator
- Context-sensitive action area: "Give your clue" / "Place the dial" / "Waiting for AI…"
- After reveal: target animates in, score updates, AI reasoning panel (tap to expand)

**4. Round Transition**
- Reveal animation
- Score delta
- Next Round prompt

**5. End Screen**
- Win/loss
- Score summary
- Shareable card (score + personality + round count)
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

*Multiplayer rooms + LLM-generated card packs. Priority 1 after working MVP.*

### Added Scope
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
