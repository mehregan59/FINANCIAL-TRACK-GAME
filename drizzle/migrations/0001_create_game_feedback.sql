CREATE TABLE public.game_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  enjoyed text,
  learned text,
  improve text,
  player_name text,
  game_mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.game_feedback TO service_role;
ALTER TABLE public.game_feedback ENABLE ROW LEVEL SECURITY;