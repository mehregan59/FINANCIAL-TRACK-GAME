GRANT INSERT ON public.feedback_responses TO anon, authenticated;
CREATE POLICY "anyone submits feedback" ON public.feedback_responses FOR INSERT TO anon, authenticated
WITH CHECK (length(coalesce(notes,'')) <= 2000 AND length(coalesce(player_name,'')) <= 40 AND length(coalesce(game_mode,'')) <= 40 AND pg_column_size(answers) < 8000);