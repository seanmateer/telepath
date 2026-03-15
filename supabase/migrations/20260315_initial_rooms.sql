create table if not exists public.rooms (
  room_code text primary key,
  version bigint not null,
  room_path text not null,
  status text not null check (status in ('lobby', 'in-game', 'complete', 'expired')),
  personality text not null check (personality in ('lumen', 'sage', 'flux')),
  host_participant_id text,
  current_psychic_participant_id text,
  private_state jsonb not null,
  public_state jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_active_at timestamptz not null,
  expires_at timestamptz not null,
  constraint rooms_room_code_length check (char_length(room_code) = 6)
);

create index if not exists rooms_last_active_at_idx on public.rooms (last_active_at desc);
create index if not exists rooms_expires_at_idx on public.rooms (expires_at);

create table if not exists public.room_participants (
  participant_id text primary key,
  room_code text not null references public.rooms(room_code) on delete cascade,
  display_name text not null,
  initials text not null,
  join_order integer not null,
  color_name text not null,
  seat_state text not null check (seat_state in ('joined', 'left')),
  connection_state text not null check (connection_state in ('online', 'reconnecting', 'offline')),
  joined_at timestamptz not null,
  last_seen_at timestamptz not null,
  token_issued_at timestamptz not null,
  token_hash text not null,
  constraint room_participants_join_order_positive check (join_order > 0),
  constraint room_participants_room_join_order_unique unique (room_code, join_order)
);

create unique index if not exists room_participants_room_token_hash_idx
  on public.room_participants (room_code, token_hash);

create index if not exists room_participants_room_code_idx
  on public.room_participants (room_code);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on public.rooms;

create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at_timestamp();
