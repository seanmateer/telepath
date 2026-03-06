# CLAUDE.md
*Claude Code-specific instructions. Extends `AGENTS.md` — read that first.*

> `AGENTS.md` is the canonical source of truth for all universal project context (tech stack, architecture, rules, game logic, scope). This file adds **only** Claude Code-specific session management and native Tasks instructions. Do not duplicate content from `AGENTS.md` here — if something applies to all agents, it belongs there.

---

## File Sync Responsibility

If you modify any universal content (tech stack, project structure, env vars, non-negotiable rules, milestone scope) in either file, **update the other file to match before committing.** Include both files in the same commit when syncing.

Current universal env vars (maintained in `AGENTS.md` and `.env.example`): `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Session & Progress Management

### At the start of every session:
1. Read `AGENTS.md` and `PROGRESS.md` before writing any code
2. Identify the current phase and next uncompleted task
3. Use Claude Code's native **Tasks** (`Ctrl+T`) to create the session's task list with dependencies — do not start a task that depends on an incomplete one
4. Note the task as in-progress in `PROGRESS.md`

### After completing each task:
1. Verify end-to-end — run the dev server, test as a user would, check mobile viewport
2. Check off the task in `PROGRESS.md` with a brief note
3. **Commit immediately** — after every single checkbox, not at phase boundaries:
   ```bash
   git add -A && git commit -m "[phase-X] description of what was just completed"
   ```
4. Only then move to the next task

### Commit rules:
- One logical change per commit — never bundle multiple tasks into one commit
- Always include `PROGRESS.md` in the commit alongside the code change
- Commit message format: `[phase-0]`, `[phase-1]`, `[phase-2]` etc. as prefix
- If mid-task at session end, commit with `[wip]` prefix and a clear description of what's in progress

### Blockers:
- If blocked, mark the task `🚫 Blocked` in `PROGRESS.md` with a clear description and **stop**
- Do not silently work around blockers or skip ahead
- Log the blocker in the Blockers Log table in `PROGRESS.md`

### At session end:
- Add a row to the Session Log in `PROGRESS.md`
- Commit everything — never leave uncommitted work

### Never mark a task done without:
- Running the dev server and testing the feature manually
- Checking mobile viewport (390px) — use a real device for Phase 3 (Dial UI)
- Verifying the edge function is being called for any AI features (not Anthropic directly)
