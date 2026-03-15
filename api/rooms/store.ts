import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isProductionEnvironment } from '../aiSecurity.js';
import { sanitizeRoomPrivateState } from '../../src/lib/roomState.js';
import type {
  CursorColorName,
  ParticipantConnectionState,
  ParticipantSeatState,
  RoomParticipantRecord,
  RoomPrivateState,
  RoomPublicState,
  RoomStatus,
} from '../../src/types/room.js';

export type StoredRoomParticipantRecord = RoomParticipantRecord & {
  tokenHash: string;
};

export type StoredRoomState = Omit<RoomPrivateState, 'participants'> & {
  participants: StoredRoomParticipantRecord[];
};

export type RoomStore = {
  createRoom: (room: StoredRoomState) => Promise<void>;
  getRoomByCode: (roomCode: string) => Promise<StoredRoomState | null>;
  updateRoom: (room: StoredRoomState) => Promise<void>;
  deleteRoom: (roomCode: string) => Promise<void>;
  deleteExpiredRooms: (nowIso: string) => Promise<number>;
};

type RoomRow = {
  room_code: string;
  version: number;
  room_path: string;
  status: RoomStatus;
  personality: RoomPrivateState['personality'];
  host_participant_id: string | null;
  current_psychic_participant_id: string | null;
  private_state: StoredRoomState;
  public_state: RoomPublicState;
  created_at: string;
  updated_at: string;
  last_active_at: string;
  expires_at: string;
};

type RoomParticipantRow = {
  participant_id: string;
  room_code: string;
  display_name: string;
  initials: string;
  join_order: number;
  color_name: CursorColorName;
  seat_state: ParticipantSeatState;
  connection_state: ParticipantConnectionState;
  joined_at: string;
  last_seen_at: string;
  token_issued_at: string;
  token_hash: string;
};

let roomStoreOverride: RoomStore | null = null;
let cachedSupabaseStore: RoomStore | null = null;
let cachedDevMemoryStore: RoomStore | null = null;
let hasWarnedMissingRoomStoreConfig = false;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isStoredRoomState = (value: unknown): value is StoredRoomState => {
  if (!isRecord(value) || !Array.isArray(value.participants)) {
    return false;
  }

  return (
    typeof value.roomCode === 'string' &&
    typeof value.roomPath === 'string' &&
    typeof value.status === 'string' &&
    typeof value.personality === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.lastActiveAt === 'string' &&
    typeof value.expiresAt === 'string' &&
    typeof value.version === 'number'
  );
};

const toRoomRow = (room: StoredRoomState): RoomRow => {
  return {
    room_code: room.roomCode,
    version: room.version,
    room_path: room.roomPath,
    status: room.status,
    personality: room.personality,
    host_participant_id: room.hostParticipantId,
    current_psychic_participant_id: room.currentPsychicParticipantId,
    private_state: room,
    public_state: toPublicRoomState(room),
    created_at: room.createdAt,
    updated_at: room.updatedAt,
    last_active_at: room.lastActiveAt,
    expires_at: room.expiresAt,
  };
};

const toParticipantRows = (
  room: StoredRoomState,
): RoomParticipantRow[] => {
  return room.participants.map((participant) => ({
    participant_id: participant.participantId,
    room_code: room.roomCode,
    display_name: participant.displayName,
    initials: participant.initials,
    join_order: participant.joinOrder,
    color_name: participant.colorName,
    seat_state: participant.seatState,
    connection_state: participant.connectionState,
    joined_at: participant.joinedAt,
    last_seen_at: participant.lastSeenAt,
    token_issued_at: participant.tokenIssuedAt,
    token_hash: participant.tokenHash,
  }));
};

const stripStoredParticipantSecrets = (
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

export const stripStoredRoomSecrets = (
  room: StoredRoomState,
): RoomPrivateState => {
  return {
    ...room,
    participants: room.participants.map(stripStoredParticipantSecrets),
  };
};

export const toPublicRoomState = (room: StoredRoomState): RoomPublicState => {
  return sanitizeRoomPrivateState(stripStoredRoomSecrets(room));
};

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, StoredRoomState>();

  async createRoom(room: StoredRoomState): Promise<void> {
    this.rooms.set(room.roomCode, structuredClone(room));
  }

  async getRoomByCode(roomCode: string): Promise<StoredRoomState | null> {
    const room = this.rooms.get(roomCode);
    return room ? structuredClone(room) : null;
  }

  async updateRoom(room: StoredRoomState): Promise<void> {
    this.rooms.set(room.roomCode, structuredClone(room));
  }

  async deleteRoom(roomCode: string): Promise<void> {
    this.rooms.delete(roomCode);
  }

  async deleteExpiredRooms(nowIso: string): Promise<number> {
    let deletedCount = 0;

    for (const [roomCode, room] of this.rooms.entries()) {
      if (room.expiresAt <= nowIso) {
        this.rooms.delete(roomCode);
        deletedCount += 1;
      }
    }

    return deletedCount;
  }
}

const hasSupabaseRoomEnv = (): boolean => {
  return Boolean(
    process.env.VITE_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
};

const createSupabaseRoomClient = (): SupabaseClient => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
    throw new Error(
      'Room storage is not configured. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const createSupabaseRoomStore = (
  client: SupabaseClient = createSupabaseRoomClient(),
): RoomStore => {
  return {
    async createRoom(room) {
      const roomRow = toRoomRow(room);
      const participantRows = toParticipantRows(room);

      const { error: roomError } = await client.from('rooms').insert(roomRow);
      if (roomError) {
        throw new Error(`Failed to create room: ${roomError.message}`);
      }

      if (participantRows.length > 0) {
        const { error: participantError } = await client
          .from('room_participants')
          .insert(participantRows);
        if (participantError) {
          throw new Error(
            `Failed to create room participants: ${participantError.message}`,
          );
        }
      }
    },

    async getRoomByCode(roomCode) {
      const { data, error } = await client
        .from('rooms')
        .select('private_state')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load room: ${error.message}`);
      }

      if (!data?.private_state) {
        return null;
      }

      return isStoredRoomState(data.private_state) ? data.private_state : null;
    },

    async updateRoom(room) {
      const roomRow = toRoomRow(room);
      const participantRows = toParticipantRows(room);

      const { error: roomError } = await client
        .from('rooms')
        .upsert(roomRow, { onConflict: 'room_code' });
      if (roomError) {
        throw new Error(`Failed to update room: ${roomError.message}`);
      }

      if (participantRows.length > 0) {
        const { error: participantError } = await client
          .from('room_participants')
          .upsert(participantRows, { onConflict: 'participant_id' });
        if (participantError) {
          throw new Error(
            `Failed to update room participants: ${participantError.message}`,
          );
        }
      }
    },

    async deleteRoom(roomCode) {
      const { error } = await client.from('rooms').delete().eq('room_code', roomCode);
      if (error) {
        throw new Error(`Failed to delete room: ${error.message}`);
      }
    },

    async deleteExpiredRooms(nowIso) {
      const { data, error: readError } = await client
        .from('rooms')
        .select('room_code')
        .lte('expires_at', nowIso);

      if (readError) {
        throw new Error(`Failed to read expired rooms: ${readError.message}`);
      }

      const expiredCount = data?.length ?? 0;
      if (expiredCount === 0) {
        return 0;
      }

      const { error: deleteError } = await client
        .from('rooms')
        .delete()
        .lte('expires_at', nowIso);
      if (deleteError) {
        throw new Error(`Failed to delete expired rooms: ${deleteError.message}`);
      }

      return expiredCount;
    },
  };
};

export const setRoomStoreForTests = (store: RoomStore | null): void => {
  roomStoreOverride = store;
  cachedSupabaseStore = null;
  cachedDevMemoryStore = null;
  hasWarnedMissingRoomStoreConfig = false;
};

export const getRoomStore = (): RoomStore => {
  if (roomStoreOverride) {
    return roomStoreOverride;
  }

  if (!hasSupabaseRoomEnv()) {
    if (isProductionEnvironment()) {
      return createSupabaseRoomStore();
    }

    if (!hasWarnedMissingRoomStoreConfig) {
      hasWarnedMissingRoomStoreConfig = true;
      console.warn(
        'Room storage fallback enabled: using in-memory room store because Supabase room env vars are missing.',
      );
    }

    if (!cachedDevMemoryStore) {
      cachedDevMemoryStore = new MemoryRoomStore();
    }

    return cachedDevMemoryStore;
  }

  if (!cachedSupabaseStore) {
    cachedSupabaseStore = createSupabaseRoomStore();
  }

  return cachedSupabaseStore;
};
