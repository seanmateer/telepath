# Telepath 1.0 Multiplayer Architecture

This doc locks the first-cut 1.0 room model before Supabase schema or `/api/rooms/*` work begins.

## Scope

- One shared human team vs. AI.
- Competitive mode only for rooms.
- Fixed shared board with named cursors and shared dial preview.
- Host-only phase commits.
- No shared camera movement.
- No spectator mode.
- No two-human-team logic in the first release.

## Canonical Code Interfaces

The source-of-truth interfaces live in:

- `src/types/room.ts`
- `src/lib/roomState.ts`

These types should drive the database schema, API payloads, and client wiring rather than being redefined later in Supabase or route handlers.

## Room Addressing

- Room codes are 6 characters.
- Codes are uppercase.
- Code alphabet is `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Ambiguous characters (`I`, `O`, `1`, `0`) are excluded.
- Canonical room URL format is `/room/:code`.
- The client should normalize pasted/lowercase codes to uppercase before join attempts.
- Invalid codes are rejected before any network request.

## Authority Boundaries

### Public room state

`RoomPublicState` is safe to broadcast to all joined clients. It includes:

- room metadata: code, path, timestamps, lifecycle status, selected AI personality
- roster summary: display names, join order, cursor color, connection state, host marker
- sanitized game snapshot: current phase, visible clue/guess/result data, scores, winner

### Private room state

`RoomPrivateState` is server-only and authoritative. It includes:

- the full `GameState` reducer snapshot
- hidden target positions before reveal
- reconnect-bearing participant records and token issuance metadata
- current human psychic participant id

### Hidden-state rule

- Before `reveal`, the round target stays server-side only.
- At `reveal`, `score`, `next-round`, and `game-over`, `sanitizeRoomPrivateState` exposes the target through `revealedTargetPosition`.
- Clients never receive raw `gameState.round.targetPosition` directly.

### Client actions vs server-derived actions

`RoomAction` is limited to client intent:

- `set_personality`
- `start_game`
- `submit_human_clue`
- `lock_guess`
- `reveal_round`
- `next_round`
- `restart_game`
- `leave_room`

AI clue generation and AI bonus guesses are server-derived side effects, not client action types.

## Versioning and Idempotency

Every client `RoomAction` includes:

- `clientActionId`
- `expectedRoomVersion`
- `actorParticipantId`

This gives the backend a stable base for:

- deduplicating retried submits
- rejecting stale writes cleanly
- returning a fresh `RoomPublicState` on conflict

## Participant Identity and Reconnect

### Participant token

Each seat gets a `ParticipantToken`:

- opaque secret issued by the server
- stored locally per room
- used on refresh/rejoin to reclaim the same participant id and join order

The token is the seat claim. Display name alone is never authoritative.

### Join order

- Join order is assigned once, server-side, when the participant record is created.
- Reconnects preserve the same join order.
- Human psychic rotation uses join order, not current tab order.

### Psychic rotation

- Only human-team turns use `currentPsychicParticipantId`.
- Rotation walks joined participants in join-order order.
- `online` and `reconnecting` seats stay eligible.
- `offline` or `left` seats are skipped.

### Host reassignment

- The host keeps ownership while briefly reconnecting.
- Grace window: 30 seconds.
- After the grace window, the next `online` joined participant by join order becomes host.
- If nobody else is online, the room keeps no promoted host until someone reconnects.

## Presence Model

Presence is transient Supabase realtime state, not durable room state.

`ParticipantPresence` carries:

- normalized cursor point (`x`, `y`) relative to the fixed board container
- current dial preview position if dragging
- `isDragging`
- current board dimensions for interpolation/debugging
- `updatedAt`

Rules:

- Cursor coordinates are normalized to `0..1` against the board wrapper.
- Shared dial preview comes from presence broadcasts, not `RoomAction`.
- The only durable dial value is the host-committed `guessPosition`.
- Last movement wins for preview.
- Presence expires quickly; stale cursors should disappear after about 10 seconds without updates.
- No synchronized zoom/pan state is broadcast in 1.0.

## Local One-Laptop Dev Loop

Goal: validate room behavior with one machine and 2 to 4 tabs before using real devices.

### Setup

- Run the app locally with the frontend and room APIs.
- Use one normal browser window for the host.
- Use separate profiles or incognito windows for guests so local storage tokens stay isolated.
- Keep DevTools open in at least one host tab and one guest tab.

### Manual loop

1. Host creates a room and lands in `/room/:code`.
2. Guest joins by pasted URL, not by copying app state manually.
3. Refresh host and guest separately to confirm token-based reclaim.
4. Drag from multiple tabs at once to observe preview arbitration.
5. Disconnect the host tab and wait past the grace window to verify host promotion.
6. Reopen the old host and confirm it returns as a non-host participant unless promoted again explicitly.

## Multi-Page Playwright Smoke Plan

This is the intended first smoke suite once the room shell exists.

### Page 1: Host create flow

- open `/`
- select competitive mode
- create room
- assert redirect to `/room/:code`
- assert host badge, room code, selected personality, and empty/solo roster state

### Page 2: Guest join flow

- open a second isolated browser context
- navigate directly to the shared room URL
- enter display name and join
- assert roster shows both players in the same order in both contexts

### Page 3: Lobby sync

- host changes personality
- assert the change appears in guest view
- verify only host sees enabled start controls

### Page 4: Shared interaction

- host starts game
- guest drags dial
- host drags dial
- assert both pages receive preview updates
- host locks guess
- assert only the locked position becomes durable state

### Page 5: Reveal and round advance

- assert clue, reveal, score, and next-round states stay synchronized
- confirm target stays hidden before reveal in guest-observable payloads
- confirm target appears after reveal

### Page 6: Reconnect and host promotion

- refresh guest and assert same seat/name/join order
- close host context, wait past grace window, assert next online participant becomes host
- reopen former host and assert clean rejoin without duplicate roster entry

## Backend Guardrails for Phase 1

Phase 1 should preserve these constraints:

- database rows store private room state; broadcasts use sanitized public state
- participant token secrets never enter `RoomPublicState`
- API routes remain the only authority for state transitions
- Supabase presence is additive and transient, never the source of truth for scoring or phase
