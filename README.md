# Telepath

 A web-based adaptation of the Wavelength board game where you play against an LLM opponent.

<!-- [Play Telepath](#) &nbsp;·&nbsp; [Report a bug](../../issues) &nbsp;·&nbsp; [Project plan](telepath-project-plan.md) -->

<!-- --- -->

<!-- ## What is this?

Wavelength is a party game about spectrum thinking. A psychic gives a one-word clue for where a hidden target falls on a spectrum — say, between **COLD** and **HOT**, or **Overrated** and **Underrated**. Your team places a dial. The reveal shows how close you got.

Telepath's twist: **you always play against an AI opponent**. The AI isn't a background system — it's a real rival that gives clues when it's the psychic and tries to read yours when you are. Each AI personality thinks differently, and figuring out how it reasons is half the game. -->



<!-- ## How to Play

1. **Choose an AI personality** to face off against
2. **Alternate turns as psychic** — giving a clue for where the hidden target sits on the current spectrum
3. **The opposing team places the dial** based on the clue
4. **Reveal** — see the target, score points based on how close you got
5. **First to 10 points wins**

**Scoring:**
- Bullseye (center zone): 4 pts
- Adjacent zone: 3 pts  
- Outer zone: 2 pts
- Miss: 0 pts
- Bonus guess (left/right): 1 pt for the opposing team

--- -->

<!-- ## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| AI | Anthropic API (Claude Sonnet + Haiku) |
| Backend | Vercel Edge Functions (API proxy) |
| Hosting | Vercel |

All Anthropic API calls are proxied through a Vercel Edge Function. See [SECURITY.md](SECURITY.md) for details.

--- -->

<!-- ## Running Locally

```bash
# Clone the repo
git clone https://github.com/yourusername/telepath.git
cd telepath

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Start the dev server
npm run dev
```

The edge function runs locally via Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

--- -->

## Project Status

**Currently:** Building MVP — solo vs. AI, static 80-card deck, core game loop.

| Milestone | Status | Scope |
|---|---|---|
| **MVP** | 🔨 In progress | Solo vs. AI, 80-card deck, 3 personalities |
| **1.0** | Planned | Human multiplayer rooms, themed card packs |
| **2.0** | Planned | Player-generated packs, pack sharing, scoring options |


## For AI Coding Agents

This repo is set up for autonomous agent development. If you're an agent working on this codebase:

- Read **[AGENTS.md](AGENTS.md)** first — universal instructions for any agent
- Read **[CLAUDE.md](CLAUDE.md)** if you're Claude Code — additional CC-specific instructions
- Read **[PROGRESS.md](PROGRESS.md)** — current task state, what to build next, commit checkpoints


## Contributing

This is a personal side project but issues and PRs are welcome. Please open an issue before starting significant work so we can discuss direction.


## Attribution

Telepath is inspired by [Wavelength](https://www.cmyk.games/collections/games/products/wavelength), a social guessing game where two teams compete to read each other's minds. This project is not affiliated with or endorsed by the designers or publisher. If you enjoy Telepath, consider [buying the physical Wavelength game](https://www.cmyk.games/collections/games/products/wavelength).


## License

MIT
