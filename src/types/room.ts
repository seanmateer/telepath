import type {
  BonusDirection,
  GamePhase,
  GameScore,
  GameState,
  Personality,
  RoundResult,
  SpectrumCard,
  Team,
} from './game.js';

export type RoomCode = string;

export type RoomStatus = 'lobby' | 'in-game' | 'complete' | 'expired';

export type ParticipantSeatState = 'joined' | 'left';

export type ParticipantConnectionState = 'online' | 'reconnecting' | 'offline';

export type CursorColorName =
  | 'blue'
  | 'teal'
  | 'sage'
  | 'gold'
  | 'coral'
  | 'rose';

export type ParticipantToken = {
  version: 1;
  roomCode: RoomCode;
  participantId: string;
  secret: string;
  issuedAt: string;
};

export type RoomParticipantRecord = {
  participantId: string;
  displayName: string;
  initials: string;
  joinOrder: number;
  colorName: CursorColorName;
  seatState: ParticipantSeatState;
  connectionState: ParticipantConnectionState;
  joinedAt: string;
  lastSeenAt: string;
  tokenIssuedAt: string;
};

export type RoomParticipantSummary = {
  participantId: string;
  displayName: string;
  initials: string;
  joinOrder: number;
  colorName: CursorColorName;
  connectionState: ParticipantConnectionState;
  isHost: boolean;
};

export type NormalizedBoardPoint = {
  x: number;
  y: number;
};

export type ParticipantPresence = {
  participantId: string;
  cursor: NormalizedBoardPoint | null;
  dialPosition: number | null;
  isDragging: boolean;
  boardWidth: number;
  boardHeight: number;
  updatedAt: string;
};

export type RoomPublicRoundState = {
  roundNumber: number;
  psychicTeam: Team;
  psychicParticipantId: string | null;
  card: SpectrumCard;
  clue: string | null;
  guessPosition: number | null;
  bonusGuess: {
    team: Team;
    direction: BonusDirection;
  } | null;
  revealedTargetPosition: number | null;
  result: RoundResult | null;
};

export type RoomGamePublicState = {
  phase: GamePhase;
  scores: GameScore;
  pointsToWin: number;
  totalCards: number;
  winner: Team | null;
  round: RoomPublicRoundState | null;
};

export type RoomPublicState = {
  version: number;
  roomCode: RoomCode;
  roomPath: string;
  status: RoomStatus;
  personality: Personality;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  hostParticipantId: string | null;
  participants: RoomParticipantSummary[];
  game: RoomGamePublicState | null;
};

export type RoomPrivateState = {
  version: number;
  roomCode: RoomCode;
  roomPath: string;
  status: RoomStatus;
  personality: Personality;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  hostParticipantId: string | null;
  currentPsychicParticipantId: string | null;
  participants: RoomParticipantRecord[];
  gameState: GameState | null;
};

export type RoomActionPermission =
  | 'joined-participant'
  | 'psychic-only'
  | 'host-only';

export type RoomActionRejectionCode =
  | 'forbidden'
  | 'invalid-phase'
  | 'invalid-payload'
  | 'participant-missing'
  | 'room-expired'
  | 'room-missing'
  | 'stale-version';

type RoomActionBase = {
  roomCode: RoomCode;
  actorParticipantId: string;
  clientActionId: string;
  expectedRoomVersion: number;
};

export type RoomAction =
  | (RoomActionBase & {
      type: 'set_personality';
      personality: Personality;
    })
  | (RoomActionBase & {
      type: 'start_game';
    })
  | (RoomActionBase & {
      type: 'submit_human_clue';
      clue: string;
    })
  | (RoomActionBase & {
      type: 'lock_guess';
      guessPosition: number;
    })
  | (RoomActionBase & {
      type: 'reveal_round';
    })
  | (RoomActionBase & {
      type: 'next_round';
    })
  | (RoomActionBase & {
      type: 'restart_game';
    })
  | (RoomActionBase & {
      type: 'leave_room';
    });

export type RoomActionResult =
  | {
      ok: true;
      actionType: RoomAction['type'];
      room: RoomPublicState;
      serverTime: string;
    }
  | {
      ok: false;
      actionType: RoomAction['type'];
      code: RoomActionRejectionCode;
      message: string;
      retryable: boolean;
      serverTime: string;
      room?: RoomPublicState;
    };
