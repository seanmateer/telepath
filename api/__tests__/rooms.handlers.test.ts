import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import createRoomHandler from '../rooms/create.js';
import joinRoomHandler from '../rooms/join.js';
import roomActionHandler from '../rooms/action.js';
import { MemoryRoomStore, setRoomStoreForTests } from '../rooms/store.js';
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomActionResult,
} from '../../src/types/room.js';

type ErrorPayload = {
  ok: false;
  error: string;
  code?: string;
};

const createRequest = (
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request => {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      ...headers,
    },
    body: JSON.stringify(body),
  });
};

const parseJson = async <T>(response: Response): Promise<T> => {
  return (await response.json()) as T;
};

beforeEach(() => {
  setRoomStoreForTests(new MemoryRoomStore());
});

describe('/api/rooms/create', () => {
  it('creates a lobby room with a host participant token', async () => {
    const response = await createRoomHandler(
      createRequest('https://telepath.example/api/rooms/create', {
        personality: 'sage',
        displayName: 'Host Player',
      }),
    );

    const payload = await parseJson<CreateRoomResponse>(response);

    assert.equal(response.status, 201);
    assert.equal(payload.ok, true);
    assert.equal(payload.room.status, 'lobby');
    assert.equal(payload.room.personality, 'sage');
    assert.equal(payload.room.participants.length, 1);
    assert.equal(payload.room.participants[0]?.displayName, 'Host Player');
    assert.equal(payload.room.participants[0]?.isHost, true);
    assert.match(payload.room.roomCode, /^[A-Z2-9]{6}$/);
    assert.equal(payload.participantToken.roomCode, payload.room.roomCode);
  });
});

describe('/api/rooms/join', () => {
  it('adds guests and reconnects the same seat without duplicating roster entries', async () => {
    const createResponse = await createRoomHandler(
      createRequest('https://telepath.example/api/rooms/create', {
        personality: 'lumen',
        displayName: 'Host Player',
      }),
    );
    const createPayload = await parseJson<CreateRoomResponse>(createResponse);

    const joinResponse = await joinRoomHandler(
      createRequest('https://telepath.example/api/rooms/join', {
        roomCode: createPayload.room.roomCode,
        displayName: 'Guest Player',
      }),
    );
    const joinPayload = await parseJson<JoinRoomResponse>(joinResponse);

    assert.equal(joinResponse.status, 200);
    assert.equal(joinPayload.ok, true);
    assert.equal(joinPayload.reconnected, false);
    assert.equal(joinPayload.room.participants.length, 2);

    const reconnectResponse = await joinRoomHandler(
      createRequest('https://telepath.example/api/rooms/join', {
        roomCode: createPayload.room.roomCode,
        participantToken: joinPayload.participantToken,
      }),
    );
    const reconnectPayload = await parseJson<JoinRoomResponse>(reconnectResponse);

    assert.equal(reconnectResponse.status, 200);
    assert.equal(reconnectPayload.reconnected, true);
    assert.equal(reconnectPayload.room.participants.length, 2);
    assert.equal(
      reconnectPayload.participantToken.participantId,
      joinPayload.participantToken.participantId,
    );
  });
});

describe('/api/rooms/action', () => {
  it('blocks guest host-only actions and lets the host update the lobby and start the game', async () => {
    const createResponse = await createRoomHandler(
      createRequest('https://telepath.example/api/rooms/create', {
        personality: 'lumen',
        displayName: 'Host Player',
      }),
    );
    const createPayload = await parseJson<CreateRoomResponse>(createResponse);

    const joinResponse = await joinRoomHandler(
      createRequest('https://telepath.example/api/rooms/join', {
        roomCode: createPayload.room.roomCode,
        displayName: 'Guest Player',
      }),
    );
    const joinPayload = await parseJson<JoinRoomResponse>(joinResponse);

    const guestActionResponse = await roomActionHandler(
      createRequest('https://telepath.example/api/rooms/action', {
        participantToken: joinPayload.participantToken,
        action: {
          type: 'set_personality',
          roomCode: createPayload.room.roomCode,
          actorParticipantId: joinPayload.participantToken.participantId,
          clientActionId: 'guest-set-personality',
          expectedRoomVersion: joinPayload.room.version,
          personality: 'flux',
        },
      }),
    );
    const guestActionPayload = await parseJson<ErrorPayload>(guestActionResponse);

    assert.equal(guestActionResponse.status, 403);
    assert.equal(guestActionPayload.code, 'forbidden');

    const hostSetPersonalityResponse = await roomActionHandler(
      createRequest('https://telepath.example/api/rooms/action', {
        participantToken: createPayload.participantToken,
        action: {
          type: 'set_personality',
          roomCode: createPayload.room.roomCode,
          actorParticipantId: createPayload.participantToken.participantId,
          clientActionId: 'host-set-personality',
          expectedRoomVersion: joinPayload.room.version,
          personality: 'flux',
        },
      }),
    );
    const hostSetPersonalityPayload =
      await parseJson<RoomActionResult>(hostSetPersonalityResponse);

    assert.equal(hostSetPersonalityResponse.status, 200);
    assert.equal(hostSetPersonalityPayload.ok, true);
    if (!hostSetPersonalityPayload.ok) {
      return;
    }
    assert.equal(hostSetPersonalityPayload.room.personality, 'flux');

    const startGameResponse = await roomActionHandler(
      createRequest('https://telepath.example/api/rooms/action', {
        participantToken: createPayload.participantToken,
        action: {
          type: 'start_game',
          roomCode: createPayload.room.roomCode,
          actorParticipantId: createPayload.participantToken.participantId,
          clientActionId: 'host-start-game',
          expectedRoomVersion: hostSetPersonalityPayload.room.version,
        },
      }),
    );
    const startGamePayload = await parseJson<RoomActionResult>(startGameResponse);

    assert.equal(startGameResponse.status, 200);
    assert.equal(startGamePayload.ok, true);
    if (!startGamePayload.ok) {
      return;
    }
    assert.equal(startGamePayload.room.status, 'in-game');
    assert.equal(startGamePayload.room.game?.phase, 'psychic-clue');
    assert.equal(startGamePayload.room.game?.round?.psychicParticipantId, createPayload.participantToken.participantId);
  });

  it('rejects stale action versions with the latest public room state attached', async () => {
    const createResponse = await createRoomHandler(
      createRequest('https://telepath.example/api/rooms/create', {
        personality: 'sage',
      }),
    );
    const createPayload = await parseJson<CreateRoomResponse>(createResponse);

    const response = await roomActionHandler(
      createRequest('https://telepath.example/api/rooms/action', {
        participantToken: createPayload.participantToken,
        action: {
          type: 'set_personality',
          roomCode: createPayload.room.roomCode,
          actorParticipantId: createPayload.participantToken.participantId,
          clientActionId: 'stale-action',
          expectedRoomVersion: 999,
          personality: 'flux',
        },
      }),
    );
    const payload = await parseJson<ErrorPayload>(response);

    assert.equal(response.status, 409);
    assert.equal(payload.code, 'stale-version');
  });
});
