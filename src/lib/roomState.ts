import type { GamePhase } from '../types/game.js';
import type {
  RoomAction,
  RoomActionPermission,
  RoomGamePublicState,
  RoomParticipantRecord,
  RoomParticipantSummary,
  RoomPrivateState,
  RoomPublicRoundState,
  RoomPublicState,
} from '../types/room.js';

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_PATH_PREFIX = '/room';
export const ROOM_INACTIVITY_TTL_MS = 24 * 60 * 60 * 1000;
export const HOST_RECONNECT_GRACE_MS = 30_000;
export const PRESENCE_STALE_AFTER_MS = 10_000;

const TARGET_VISIBLE_PHASES: readonly GamePhase[] = [
  'reveal',
  'score',
  'next-round',
  'game-over',
];

const isPsychicEligible = (participant: RoomParticipantRecord): boolean => {
  return (
    participant.seatState === 'joined' &&
    participant.connectionState !== 'offline'
  );
};

const toSortedJoinedParticipants = (
  participants: readonly RoomParticipantRecord[],
): RoomParticipantRecord[] => {
  return participants
    .filter((participant) => participant.seatState === 'joined')
    .slice()
    .sort((left, right) => left.joinOrder - right.joinOrder);
};

const toPublicParticipants = (
  participants: readonly RoomParticipantRecord[],
  hostParticipantId: string | null,
): RoomParticipantSummary[] => {
  return toSortedJoinedParticipants(participants).map((participant) => ({
    participantId: participant.participantId,
    displayName: participant.displayName,
    initials: participant.initials,
    joinOrder: participant.joinOrder,
    colorName: participant.colorName,
    connectionState: participant.connectionState,
    isHost: participant.participantId === hostParticipantId,
  }));
};

export const normalizeRoomCode = (value: string): string => {
  return value.trim().toUpperCase();
};

export const isValidRoomCode = (value: string): boolean => {
  const normalized = normalizeRoomCode(value);
  const codePattern = new RegExp(
    `^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`,
  );

  return codePattern.test(normalized);
};

export const createRoomPath = (roomCode: string): string => {
  const normalized = normalizeRoomCode(roomCode);
  if (!isValidRoomCode(normalized)) {
    throw new Error(`Invalid room code "${roomCode}".`);
  }

  return `${ROOM_PATH_PREFIX}/${normalized}`;
};

export const parseRoomCodeFromPath = (pathname: string): string | null => {
  const match = pathname.match(/^\/room\/([A-Z0-9]{6})\/?$/i);
  if (!match) {
    return null;
  }

  const roomCode = normalizeRoomCode(match[1]);
  return isValidRoomCode(roomCode) ? roomCode : null;
};

export const getRoomExpiryTime = (lastActiveAt: string | number | Date): number => {
  const lastActiveMs =
    lastActiveAt instanceof Date
      ? lastActiveAt.getTime()
      : typeof lastActiveAt === 'number'
        ? lastActiveAt
        : Date.parse(lastActiveAt);

  return lastActiveMs + ROOM_INACTIVITY_TTL_MS;
};

export const shouldRevealTarget = (phase: GamePhase): boolean => {
  return TARGET_VISIBLE_PHASES.includes(phase);
};

const toPublicGameState = (
  room: RoomPrivateState,
): RoomGamePublicState | null => {
  const { gameState } = room;
  if (!gameState) {
    return null;
  }

  const round = gameState.round;
  const publicRound: RoomPublicRoundState | null = round
    ? {
        roundNumber: round.roundNumber,
        psychicTeam: round.psychicTeam,
        psychicParticipantId:
          round.psychicTeam === 'human' ? room.currentPsychicParticipantId : null,
        card: round.card,
        clue: round.clue,
        guessPosition: round.guessPosition,
        bonusGuess: round.bonusGuess,
        revealedTargetPosition: shouldRevealTarget(gameState.phase)
          ? round.targetPosition
          : null,
        result: round.result,
      }
    : null;

  return {
    phase: gameState.phase,
    scores: gameState.scores,
    pointsToWin: gameState.settings.pointsToWin,
    totalCards: gameState.totalCards,
    winner: gameState.winner,
    round: publicRound,
  };
};

export const sanitizeRoomPrivateState = (
  room: RoomPrivateState,
): RoomPublicState => {
  return {
    version: room.version,
    roomCode: room.roomCode,
    roomPath: room.roomPath,
    status: room.status,
    personality: room.personality,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    lastActiveAt: room.lastActiveAt,
    expiresAt: room.expiresAt,
    hostParticipantId: room.hostParticipantId,
    participants: toPublicParticipants(room.participants, room.hostParticipantId),
    game: toPublicGameState(room),
  };
};

export const getNextPsychicParticipantId = (
  participants: readonly RoomParticipantRecord[],
  currentPsychicParticipantId: string | null,
): string | null => {
  const eligibleParticipants = toSortedJoinedParticipants(participants).filter(
    isPsychicEligible,
  );

  if (eligibleParticipants.length === 0) {
    return null;
  }

  if (!currentPsychicParticipantId) {
    return eligibleParticipants[0]?.participantId ?? null;
  }

  const currentIndex = eligibleParticipants.findIndex(
    (participant) => participant.participantId === currentPsychicParticipantId,
  );

  if (currentIndex === -1) {
    return eligibleParticipants[0]?.participantId ?? null;
  }

  const nextIndex = (currentIndex + 1) % eligibleParticipants.length;
  return eligibleParticipants[nextIndex]?.participantId ?? null;
};

export const selectHostReplacement = (
  participants: readonly RoomParticipantRecord[],
  departingHostParticipantId: string | null,
): string | null => {
  const connectedParticipants = toSortedJoinedParticipants(participants).filter(
    (participant) =>
      participant.connectionState === 'online' &&
      participant.participantId !== departingHostParticipantId,
  );

  return connectedParticipants[0]?.participantId ?? null;
};

export const getRoomActionPermission = (
  actionType: RoomAction['type'],
): RoomActionPermission => {
  switch (actionType) {
    case 'submit_human_clue':
      return 'psychic-only';
    case 'set_personality':
    case 'start_game':
    case 'lock_guess':
    case 'reveal_round':
    case 'next_round':
    case 'restart_game':
      return 'host-only';
    case 'leave_room':
      return 'joined-participant';
    default: {
      const exhaustive: never = actionType;
      return exhaustive;
    }
  }
};
