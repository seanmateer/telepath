import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInitialGameState,
  revealRound,
  startGame,
  submitBonusGuess,
  submitHumanGuess,
  submitPsychicClue,
} from '../gameState.js';
import {
  createRoomPath,
  getNextPsychicParticipantId,
  getRoomActionPermission,
  getRoomExpiryTime,
  isValidRoomCode,
  normalizeRoomCode,
  parseRoomCodeFromPath,
  sanitizeRoomPrivateState,
  selectHostReplacement,
} from '../roomState.js';
import type { SpectrumCard } from '../../types/game.js';
import type { RoomParticipantRecord, RoomPrivateState } from '../../types/room.js';

const CARD_A: SpectrumCard = { id: 1, left: 'Cold', right: 'Hot' };
const CARD_B: SpectrumCard = { id: 2, left: 'Quiet', right: 'Loud' };

const buildParticipants = (): RoomParticipantRecord[] => [
  {
    participantId: 'host-1',
    displayName: 'Host Player',
    initials: 'HP',
    joinOrder: 1,
    colorName: 'blue',
    seatState: 'joined',
    connectionState: 'online',
    joinedAt: '2026-03-09T09:00:00.000Z',
    lastSeenAt: '2026-03-09T09:00:05.000Z',
    tokenIssuedAt: '2026-03-09T09:00:00.000Z',
  },
  {
    participantId: 'guest-2',
    displayName: 'Guest Player',
    initials: 'GP',
    joinOrder: 2,
    colorName: 'sage',
    seatState: 'joined',
    connectionState: 'reconnecting',
    joinedAt: '2026-03-09T09:00:10.000Z',
    lastSeenAt: '2026-03-09T09:00:20.000Z',
    tokenIssuedAt: '2026-03-09T09:00:10.000Z',
  },
  {
    participantId: 'guest-3',
    displayName: 'Offline Player',
    initials: 'OP',
    joinOrder: 3,
    colorName: 'gold',
    seatState: 'joined',
    connectionState: 'offline',
    joinedAt: '2026-03-09T09:00:15.000Z',
    lastSeenAt: '2026-03-09T09:00:25.000Z',
    tokenIssuedAt: '2026-03-09T09:00:15.000Z',
  },
  {
    participantId: 'guest-4',
    displayName: 'Former Player',
    initials: 'FP',
    joinOrder: 4,
    colorName: 'rose',
    seatState: 'left',
    connectionState: 'offline',
    joinedAt: '2026-03-09T09:00:20.000Z',
    lastSeenAt: '2026-03-09T09:00:20.000Z',
    tokenIssuedAt: '2026-03-09T09:00:20.000Z',
  },
];

const buildPrivateRoom = (): RoomPrivateState => {
  let gameState = createInitialGameState({ personality: 'sage' });
  gameState = startGame(gameState, {
    deck: [CARD_A, CARD_B],
    startingPsychicTeam: 'human',
    random: () => 0.55,
  });
  gameState = submitPsychicClue(gameState, 'sauna');
  gameState = submitHumanGuess(gameState, 64);

  return {
    version: 3,
    roomCode: 'WAVEFX',
    roomPath: createRoomPath('WAVEFX'),
    status: 'in-game',
    personality: 'sage',
    createdAt: '2026-03-09T09:00:00.000Z',
    updatedAt: '2026-03-09T09:01:00.000Z',
    lastActiveAt: '2026-03-09T09:01:00.000Z',
    expiresAt: '2026-03-10T09:01:00.000Z',
    hostParticipantId: 'host-1',
    currentPsychicParticipantId: 'host-1',
    participants: buildParticipants(),
    gameState,
  };
};

describe('room addressing helpers', () => {
  it('normalizes, validates, and parses 6-character room codes', () => {
    assert.equal(normalizeRoomCode(' wavefx '), 'WAVEFX');
    assert.equal(isValidRoomCode('WAVEFX'), true);
    assert.equal(isValidRoomCode('WAVE0X'), false);
    assert.equal(createRoomPath('wavefx'), '/room/WAVEFX');
    assert.equal(parseRoomCodeFromPath('/room/wavefx'), 'WAVEFX');
    assert.equal(parseRoomCodeFromPath('/game'), null);
  });

  it('calculates room expiry from the last activity time', () => {
    const expiryMs = getRoomExpiryTime('2026-03-09T09:01:00.000Z');
    assert.equal(new Date(expiryMs).toISOString(), '2026-03-10T09:01:00.000Z');
  });
});

describe('sanitizeRoomPrivateState', () => {
  it('hides hidden target data before reveal and filters public participants', () => {
    const room = buildPrivateRoom();

    const publicRoom = sanitizeRoomPrivateState(room);

    assert.equal(publicRoom.participants.length, 3);
    assert.equal(publicRoom.participants[0]?.participantId, 'host-1');
    assert.equal(publicRoom.participants[0]?.isHost, true);
    assert.equal(publicRoom.game?.round?.psychicParticipantId, 'host-1');
    assert.equal(publicRoom.game?.round?.revealedTargetPosition, null);
  });

  it('reveals the target once the round enters a reveal-visible phase', () => {
    const room = buildPrivateRoom();
    room.gameState = submitBonusGuess(room.gameState!, 'left');
    room.gameState = revealRound(room.gameState);

    const publicRoom = sanitizeRoomPrivateState(room);

    assert.equal(publicRoom.game?.phase, 'score');
    assert.equal(
      publicRoom.game?.round?.revealedTargetPosition,
      room.gameState.round?.targetPosition,
    );
  });
});

describe('participant rotation helpers', () => {
  it('rotates the human psychic by join order while skipping offline or departed seats', () => {
    const participants = buildParticipants();

    assert.equal(getNextPsychicParticipantId(participants, null), 'host-1');
    assert.equal(getNextPsychicParticipantId(participants, 'host-1'), 'guest-2');
    assert.equal(getNextPsychicParticipantId(participants, 'guest-2'), 'host-1');
    assert.equal(getNextPsychicParticipantId(participants, 'missing'), 'host-1');
  });

  it('promotes the earliest connected joined participant when the host drops', () => {
    const participants = buildParticipants().map((participant) =>
      participant.participantId === 'host-1'
        ? { ...participant, connectionState: 'offline' as const }
        : participant,
    );

    assert.equal(selectHostReplacement(participants, 'host-1'), null);

    const guestPromotable = participants.map((participant) =>
      participant.participantId === 'guest-2'
        ? { ...participant, connectionState: 'online' as const }
        : participant,
    );

    assert.equal(selectHostReplacement(guestPromotable, 'host-1'), 'guest-2');
  });
});

describe('room action permissions', () => {
  it('classifies host, psychic, and generic participant actions', () => {
    assert.equal(getRoomActionPermission('start_game'), 'host-only');
    assert.equal(getRoomActionPermission('lock_guess'), 'host-only');
    assert.equal(getRoomActionPermission('submit_human_clue'), 'psychic-only');
    assert.equal(getRoomActionPermission('leave_room'), 'joined-participant');
  });
});
