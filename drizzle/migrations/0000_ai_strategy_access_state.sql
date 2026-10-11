CREATE TABLE public.ai_strategy_access_state (
  model text PRIMARY KEY,
  status integer NOT NULL DEFAULT 403,
  message text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_strategy_access_state TO service_role;
ALTER TABLE public.ai_strategy_access_state ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.ai_strategy_access_state IS 'Server-only durable AI access circuit breaker; no client policies. Clear only after owner restores gateway access.';