import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  createInitialGameState,
  startGame,
} from '../../src/lib/gameState.js';
import {
  createRoomPath,
  getNextPsychicParticipantId,
  getRoomActionPermission,
  getRoomExpiryTime,
  isValidRoomCode,
  normalizeRoomCode,
  selectHostReplacement,
} from '../../src/lib/roomState.js';
import {
  createFallbackDisplayName,
  getCursorColorForJoinOrder,
  getParticipantInitials,
  normalizeDisplayName,
} from '../../src/lib/roomParticipants.js';
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ParticipantToken,
  RoomAction,
  RoomActionRequest,
  RoomActionResult,
  RoomParticipantRecord,
} from '../../src/types/room.js';
import type { Personality } from '../../src/types/game.js';
import { loadServerShuffledSpectrumDeck } from './deck.js';
import {
  getRoomStore,
  toPublicRoomState,
  type RoomStore,
  type StoredRoomParticipantRecord,
  type StoredRoomState,
} from './store.js';

const PERSONALITIES: readonly Personality[] = ['lumen', 'sage', 'flux'];
const MAX_ROOM_CODE_GENERATION_ATTEMPTS = 24;

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  error: string;
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export class RoomServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly room?: ReturnType<typeof toPublicRoomState>;

  constructor(
    status: number,
    code: string,
    message: string,
    options: {
      retryable?: boolean;
      room?: ReturnType<typeof toPublicRoomState>;
    } = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.room = options.room;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isParticipantToken = (value: unknown): value is ParticipantToken => {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.roomCode === 'string' &&
    typeof value.participantId === 'string' &&
    typeof value.secret === 'string' &&
    typeof value.issuedAt === 'string'
  );
};

const isPersonality = (value: unknown): value is Personality => {
  return typeof value === 'string' && PERSONALITIES.includes(value as Personality);
};

const normalizeOptionalDisplayName = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return normalizeDisplayName(value);
};

const generateOpaqueId = (prefix: string): string => {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
};

const generateParticipantSecret = (): string => {
  return randomBytes(18).toString('base64url');
};

const hashParticipantSecret = (secret: string): string => {
  return createHash('sha256').update(secret).digest('hex');
};

const buildParticipantToken = (
  roomCode: string,
  participantId: string,
  issuedAt: string,
): ParticipantToken => {
  return {
    version: 1,
    roomCode,
    participantId,
    secret: generateParticipantSecret(),
    issuedAt,
  };
};

const getNowIso = (): string => {
  return new Date().toISOString();
};

const createExpiresAt = (nowIso: string): string => {
  return new Date(getRoomExpiryTime(nowIso)).toISOString();
};

const touchRoom = (room: StoredRoomState, nowIso: string): StoredRoomState => {
  return {
    ...room,
    updatedAt: nowIso,
    lastActiveAt: nowIso,
    expiresAt: room.status === 'expired' ? nowIso : createExpiresAt(nowIso),
  };
};

const getJoinedParticipants = (
  participants: readonly StoredRoomParticipantRecord[],
): StoredRoomParticipantRecord[] => {
  return participants
    .filter((participant) => participant.seatState === 'joined')
    .slice()
    .sort((left, right) => left.joinOrder - right.joinOrder);
};

const toRoomParticipantRecords = (
  participants: readonly StoredRoomParticipantRecord[],
): RoomParticipantRecord[] => {
  return participants.map(stripParticipantTokenHash);
};

const stripParticipantTokenHash = (
  participant: StoredRoomParticipantRecord,
): RoomParticipantRecord => {
  return {
    participantId: participant.participantId,
    displayName: participant.displayName,
    initials: participant.initials,
    joinOrder: participant.joinOrder,
    colorName: participant.colorName,
    seatState: participant.seatState,
    connectionState: participant.connectionState,
    joinedAt: participant.joinedAt,
    lastSeenAt: participant.lastSeenAt,
    tokenIssuedAt: participant.tokenIssuedAt,
  };
};

const resolveHostParticipantId = (room: StoredRoomState): string | null => {
  const joinedParticipants = getJoinedParticipants(room.participants);
  const currentHost = joinedParticipants.find(
    (participant) => participant.participantId === room.hostParticipantId,
  );

  if (currentHost) {
    return currentHost.participantId;
  }

  return selectHostReplacement(
    toRoomParticipantRecords(room.participants),
    room.hostParticipantId,
  );
};

const resolveCurrentPsychicParticipantId = (
  room: StoredRoomState,
  departingParticipantId: string | null,
): string | null => {
  if (!room.gameState || room.gameState.round?.psychicTeam !== 'human') {
    return null;
  }

  const currentPsychicId =
    room.currentPsychicParticipantId === departingParticipantId
      ? null
      : room.currentPsychicParticipantId;

  if (currentPsychicId) {
    const currentPsychicParticipant = room.participants.find(
      (participant) =>
        participant.participantId === currentPsychicId &&
        participant.seatState === 'joined' &&
        participant.connectionState !== 'offline',
    );

    if (currentPsychicParticipant) {
      return currentPsychicParticipant.participantId;
    }
  }

  return getNextPsychicParticipantId(
    toRoomParticipantRecords(room.participants),
    null,
  );
};

const validateCreateRoomRequest = (
  value: unknown,
): ValidationResult<CreateRoomRequest> => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid payload. Expected a JSON object.' };
  }

  const personality = isPersonality(value.personality) ? value.personality : 'lumen';
  const displayName = normalizeOptionalDisplayName(value.displayName);
  if (value.displayName !== undefined && displayName === null) {
    return {
      ok: false,
      error: 'Invalid payload. `displayName` must be 1-24 visible characters.',
    };
  }

  return {
    ok: true,
    data: {
      personality,
      displayName: displayName ?? undefined,
    },
  };
};

const validateJoinRoomRequest = (
  value: unknown,
): ValidationResult<JoinRoomRequest> => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid payload. Expected a JSON object.' };
  }

  if (typeof value.roomCode !== 'string' || !isValidRoomCode(value.roomCode)) {
    return {
      ok: false,
      error: 'Invalid payload. `roomCode` must be a valid 6-character room code.',
    };
  }

  const displayName = normalizeOptionalDisplayName(value.displayName);
  if (value.displayName !== undefined && displayName === null) {
    return {
      ok: false,
      error: 'Invalid payload. `displayName` must be 1-24 visible characters.',
    };
  }

  if (
    value.participantToken !== undefined &&
    value.participantToken !== null &&
    !isParticipantToken(value.participantToken)
  ) {
    return {
      ok: false,
      error: 'Invalid payload. `participantToken` is malformed.',
    };
  }

  return {
    ok: true,
    data: {
      roomCode: normalizeRoomCode(value.roomCode),
      displayName: displayName ?? undefined,
      participantToken: value.participantToken ?? undefined,
    },
  };
};

const validateRoomAction = (value: unknown): ValidationResult<RoomAction> => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid payload. `action` must be an object.' };
  }

  const { type, roomCode, actorParticipantId, clientActionId, expectedRoomVersion } =
    value;

  if (
    typeof type !== 'string' ||
    typeof roomCode !== 'string' ||
    typeof actorParticipantId !== 'string' ||
    typeof clientActionId !== 'string' ||
    typeof expectedRoomVersion !== 'number'
  ) {
    return {
      ok: false,
      error: 'Invalid payload. `action` is missing required metadata fields.',
    };
  }

  if (!isValidRoomCode(roomCode)) {
    return {
      ok: false,
      error: 'Invalid payload. `action.roomCode` must be a valid room code.',
    };
  }

  switch (type) {
    case 'set_personality':
      if (!isPersonality(value.personality)) {
        return {
          ok: false,
          error: 'Invalid payload. `personality` must be lumen, sage, or flux.',
        };
      }
      return {
        ok: true,
        data: {
          type,
          roomCode: normalizeRoomCode(roomCode),
          actorParticipantId,
          clientActionId,
          expectedRoomVersion,
          personality: value.personality,
        },
      };
    case 'start_game':
    case 'reveal_round':
    case 'next_round':
    case 'restart_game':
    case 'leave_room':
      return {
        ok: true,
        data: {
          type,
          roomCode: normalizeRoomCode(roomCode),
          actorParticipantId,
          clientActionId,
          expectedRoomVersion,
        } as RoomAction,
      };
    case 'submit_human_clue':
      if (typeof value.clue !== 'string' || value.clue.trim().length === 0) {
        return {
          ok: false,
          error: 'Invalid payload. `clue` must be a non-empty string.',
        };
      }
      return {
        ok: true,
        data: {
          type,
          roomCode: normalizeRoomCode(roomCode),
          actorParticipantId,
          clientActionId,
          expectedRoomVersion,
          clue: value.clue.trim().replace(/\s+/g, ' '),
        },
      };
    case 'lock_guess':
      if (
        typeof value.guessPosition !== 'number' ||
        !Number.isFinite(value.guessPosition)
      ) {
        return {
          ok: false,
          error: 'Invalid payload. `guessPosition` must be a number.',
        };
      }
      return {
        ok: true,
        data: {
          type,
          roomCode: normalizeRoomCode(roomCode),
          actorParticipantId,
          clientActionId,
          expectedRoomVersion,
          guessPosition: value.guessPosition,
        },
      };
    default:
      return {
        ok: false,
        error: 'Invalid payload. Unsupported room action type.',
      };
  }
};

const validateRoomActionRequest = (
  value: unknown,
): ValidationResult<RoomActionRequest> => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid payload. Expected a JSON object.' };
  }

  if (!isParticipantToken(value.participantToken)) {
    return {
      ok: false,
      error: 'Invalid payload. `participantToken` is malformed.',
    };
  }

  const action = validateRoomAction(value.action);
  if (!action.ok) {
    return action;
  }

  return {
    ok: true,
    data: {
      participantToken: value.participantToken,
      action: action.data,
    },
  };
};

const assertTokenMatchesParticipant = (
  room: StoredRoomState,
  token: ParticipantToken,
): StoredRoomParticipantRecord => {
  const participant = room.participants.find(
    (candidate) => candidate.participantId === token.participantId,
  );
  if (!participant) {
    throw new RoomServiceError(403, 'participant-missing', 'Participant token is not valid for this room.');
  }

  const tokenHash = hashParticipantSecret(token.secret);
  if (participant.tokenHash !== tokenHash) {
    throw new RoomServiceError(403, 'forbidden', 'Participant token is not valid for this room.');
  }

  return participant;
};

const loadActiveRoom = async (
  roomCode: string,
  store: RoomStore,
  nowIso: string,
): Promise<StoredRoomState> => {
  await store.deleteExpiredRooms(nowIso);
  const room = await store.getRoomByCode(roomCode);

  if (!room) {
    throw new RoomServiceError(404, 'room-missing', 'Room not found.');
  }

  if (room.expiresAt <= nowIso || room.status === 'expired') {
    await store.deleteRoom(roomCode);
    throw new RoomServiceError(410, 'room-expired', 'Room has expired.');
  }

  return room;
};

const persistTouchedRoom = async (
  room: StoredRoomState,
  store: RoomStore,
  nowIso: string,
): Promise<StoredRoomState> => {
  const touchedRoom = touchRoom(room, nowIso);
  await store.updateRoom(touchedRoom);
  return touchedRoom;
};

const generateUniqueRoomCode = async (store: RoomStore): Promise<string> => {
  for (let attempt = 0; attempt < MAX_ROOM_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    let roomCode = '';

    for (let index = 0; index < 6; index += 1) {
      roomCode += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]!;
    }

    const existingRoom = await store.getRoomByCode(roomCode);
    if (!existingRoom) {
      return roomCode;
    }
  }

  throw new RoomServiceError(
    503,
    'room-missing',
    'Could not generate a unique room code. Please try again.',
    { retryable: true },
  );
};

const createStoredParticipant = (
  roomCode: string,
  joinOrder: number,
  displayName: string,
  nowIso: string,
): {
  participant: StoredRoomParticipantRecord;
  participantToken: ParticipantToken;
} => {
  const participantId = generateOpaqueId('participant');
  const participantToken = buildParticipantToken(roomCode, participantId, nowIso);

  return {
    participant: {
      participantId,
      displayName,
      initials: getParticipantInitials(displayName),
      joinOrder,
      colorName: getCursorColorForJoinOrder(joinOrder),
      seatState: 'joined',
      connectionState: 'online',
      joinedAt: nowIso,
      lastSeenAt: nowIso,
      tokenIssuedAt: nowIso,
      tokenHash: hashParticipantSecret(participantToken.secret),
    },
    participantToken,
  };
};

export const parseCreateRoomRequest = (
  value: unknown,
): ValidationResult<CreateRoomRequest> => {
  return validateCreateRoomRequest(value);
};

export const parseJoinRoomRequest = (
  value: unknown,
): ValidationResult<JoinRoomRequest> => {
  return validateJoinRoomRequest(value);
};

export const parseRoomActionRequest = (
  value: unknown,
): ValidationResult<RoomActionRequest> => {
  return validateRoomActionRequest(value);
};

export const createRoom = async (
  request: CreateRoomRequest,
  store: RoomStore = getRoomStore(),
): Promise<CreateRoomResponse> => {
  const nowIso = getNowIso();
  await store.deleteExpiredRooms(nowIso);

  const roomCode = await generateUniqueRoomCode(store);
  const roomPath = createRoomPath(roomCode);
  const displayName =
    normalizeDisplayName(request.displayName) ?? createFallbackDisplayName();
  const { participant, participantToken } = createStoredParticipant(
    roomCode,
    1,
    displayName,
    nowIso,
  );

  const room: StoredRoomState = {
    version: 1,
    roomCode,
    roomPath,
    status: 'lobby',
    personality: request.personality ?? 'lumen',
    createdAt: nowIso,
    updatedAt: nowIso,
    lastActiveAt: nowIso,
    expiresAt: createExpiresAt(nowIso),
    hostParticipantId: participant.participantId,
    currentPsychicParticipantId: null,
    participants: [participant],
    gameState: null,
  };

  await store.createRoom(room);

  return {
    ok: true,
    room: toPublicRoomState(room),
    participantToken,
  };
};

export const joinRoom = async (
  request: JoinRoomRequest,
  store: RoomStore = getRoomStore(),
): Promise<JoinRoomResponse> => {
  const nowIso = getNowIso();
  const room = await loadActiveRoom(normalizeRoomCode(request.roomCode), store, nowIso);

  if (request.participantToken) {
    if (normalizeRoomCode(request.participantToken.roomCode) !== room.roomCode) {
      throw new RoomServiceError(400, 'invalid-payload', 'Participant token does not match the requested room.');
    }

    const participant = assertTokenMatchesParticipant(room, request.participantToken);
    participant.connectionState = 'online';
    participant.lastSeenAt = nowIso;

    const touchedRoom = await persistTouchedRoom(room, store, nowIso);
    return {
      ok: true,
      room: toPublicRoomState(touchedRoom),
      participantToken: request.participantToken,
      reconnected: true,
    };
  }

  const joinedParticipants = getJoinedParticipants(room.participants);
  const displayName =
    normalizeDisplayName(request.displayName) ?? createFallbackDisplayName();
  const { participant, participantToken } = createStoredParticipant(
    room.roomCode,
    joinedParticipants.length + 1,
    displayName,
    nowIso,
  );

  room.participants = [...room.participants, participant];
  room.version += 1;

  const touchedRoom = await persistTouchedRoom(room, store, nowIso);
  return {
    ok: true,
    room: toPublicRoomState(touchedRoom),
    participantToken,
    reconnected: false,
  };
};

const assertActionPermission = (
  room: StoredRoomState,
  action: RoomAction,
  participant: StoredRoomParticipantRecord,
): void => {
  if (participant.seatState !== 'joined') {
    throw new RoomServiceError(403, 'forbidden', 'Participant is no longer joined to this room.');
  }

  const permission = getRoomActionPermission(action.type);
  if (permission === 'joined-participant') {
    return;
  }

  if (permission === 'host-only' && room.hostParticipantId !== participant.participantId) {
    throw new RoomServiceError(403, 'forbidden', 'Only the room host may perform this action.', {
      room: toPublicRoomState(room),
    });
  }

  if (
    permission === 'psychic-only' &&
    room.currentPsychicParticipantId !== participant.participantId
  ) {
    throw new RoomServiceError(403, 'forbidden', 'Only the active human psychic may perform this action.', {
      room: toPublicRoomState(room),
    });
  }
};

const applyLeaveRoom = (
  room: StoredRoomState,
  participantId: string,
  nowIso: string,
): StoredRoomState => {
  room.participants = room.participants.map((participant) =>
    participant.participantId === participantId
      ? {
          ...participant,
          seatState: 'left',
          connectionState: 'offline',
          lastSeenAt: nowIso,
        }
      : participant,
  );

  room.hostParticipantId = resolveHostParticipantId(room);
  room.currentPsychicParticipantId = resolveCurrentPsychicParticipantId(
    room,
    participantId,
  );

  if (getJoinedParticipants(room.participants).length === 0) {
    room.status = 'expired';
    room.hostParticipantId = null;
    room.currentPsychicParticipantId = null;
  }

  return room;
};

const applyRoomActionUpdate = async (
  room: StoredRoomState,
  action: RoomAction,
  nowIso: string,
): Promise<StoredRoomState> => {
  switch (action.type) {
    case 'set_personality':
      if (room.status !== 'lobby') {
        throw new RoomServiceError(409, 'invalid-phase', 'Personality can only be changed while the room is in the lobby.', {
          room: toPublicRoomState(room),
        });
      }

      return {
        ...room,
        version: room.version + 1,
        personality: action.personality,
      };

    case 'start_game': {
      if (room.status !== 'lobby') {
        throw new RoomServiceError(409, 'invalid-phase', 'Game has already started.', {
          room: toPublicRoomState(room),
        });
      }

      const deck = await loadServerShuffledSpectrumDeck();
      let gameState = createInitialGameState({ personality: room.personality });
      gameState = startGame(gameState, {
        deck,
        startingPsychicTeam: 'human',
      });

      return {
        ...room,
        version: room.version + 1,
        status: 'in-game',
        gameState,
        currentPsychicParticipantId: getNextPsychicParticipantId(
          toRoomParticipantRecords(room.participants),
          null,
        ),
      };
    }

    case 'restart_game':
      return {
        ...room,
        version: room.version + 1,
        status: 'lobby',
        currentPsychicParticipantId: null,
        gameState: null,
      };

    case 'leave_room':
      return {
        ...applyLeaveRoom(room, action.actorParticipantId, nowIso),
        version: room.version + 1,
      };

    case 'submit_human_clue':
    case 'lock_guess':
    case 'reveal_round':
    case 'next_round':
      throw new RoomServiceError(
        501,
        'not-implemented',
        `Room action "${action.type}" is reserved for the competitive gameplay integration phase.`,
        {
          room: toPublicRoomState(room),
        },
      );

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
};

export const applyRoomAction = async (
  request: RoomActionRequest,
  store: RoomStore = getRoomStore(),
): Promise<RoomActionResult> => {
  const nowIso = getNowIso();
  const room = await loadActiveRoom(request.action.roomCode, store, nowIso);
  const participant = assertTokenMatchesParticipant(room, request.participantToken);

  participant.connectionState = 'online';
  participant.lastSeenAt = nowIso;

  if (request.action.actorParticipantId !== participant.participantId) {
    throw new RoomServiceError(403, 'forbidden', 'Room action actor does not match the participant token.', {
      room: toPublicRoomState(room),
    });
  }

  if (request.action.expectedRoomVersion !== room.version) {
    throw new RoomServiceError(409, 'stale-version', 'Room version is stale. Refresh and retry with the latest room state.', {
      room: toPublicRoomState(room),
    });
  }

  assertActionPermission(room, request.action, participant);

  const updatedRoom = await applyRoomActionUpdate(room, request.action, nowIso);
  const touchedRoom = touchRoom(updatedRoom, nowIso);
  await store.updateRoom(touchedRoom);

  return {
    ok: true,
    actionType: request.action.type,
    room: toPublicRoomState(touchedRoom),
    serverTime: nowIso,
  };
};
