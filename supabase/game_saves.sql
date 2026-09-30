-- Capital Clash: saved games (run once in Supabase: SQL Editor -> New query -> paste -> Run).
-- The host's browser saves the whole game here after every step, so a room can be resumed by its code.

create table if not exists public.game_saves (
    room_code  text primary key,
    state      jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.game_saves enable row level security;

-- The game uses the public (publishable) key, so these policies allow it to read and write saves.
-- A save only contains the game state (names, positions, money, shares), nothing private.
drop policy if exists "game_saves read"   on public.game_saves;
drop policy if exists "game_saves insert" on public.game_saves;
drop policy if exists "game_saves update" on public.game_saves;
create policy "game_saves read"   on public.game_saves for select to anon using (true);
create policy "game_saves insert" on public.game_saves for insert to anon with check (true);
create policy "game_saves update" on public.game_saves for update to anon using (true) with check (true);

-- Optional clean-up of games untouched for 30 days (run now and then):
-- delete from public.game_saves where updated_at < now() - interval '30 days';
