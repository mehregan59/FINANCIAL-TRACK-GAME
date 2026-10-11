CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- The very first account becomes the owner (admin); later accounts get no admin role.
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_first_admin();

CREATE TABLE public.feedback_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position int NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'game',
  question text NOT NULL,
  options text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feedback_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feedback_questions TO authenticated;
GRANT ALL ON public.feedback_questions TO service_role;
ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active questions public" ON public.feedback_questions FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert questions" ON public.feedback_questions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update questions" ON public.feedback_questions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete questions" ON public.feedback_questions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answers jsonb NOT NULL DEFAULT '{}',
  notes text,
  player_name text,
  game_mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.feedback_responses TO authenticated;
GRANT ALL ON public.feedback_responses TO service_role;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read responses" ON public.feedback_responses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete responses" ON public.feedback_responses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  player_name text,
  game_mode text,
  browser text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read bugs" ON public.bug_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update bugs" ON public.bug_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete bugs" ON public.bug_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.feedback_questions (position, section, question, options) VALUES
(1, 'game', 'How did the speed of the game feel?', ARRAY['Too slow','Just right','Too fast']),
(2, 'game', 'Were the Tiles on the Space Board easy to read?', ARRAY['Very clear','Mostly clear','Hard to read']),
(3, 'game', 'How easy was buying and selling at The Bank?', ARRAY['Easy','OK','Confusing']),
(4, 'game', 'How did the Event Cards feel?', ARRAY['Exciting','Balanced','Too punishing']),
(5, 'game', 'Would you play Capital Clash again?', ARRAY['Definitely','Maybe','Probably not']),
(6, 'learning', 'Did the Bull / Bear forecast help you decide when to trade?', ARRAY['Yes, a lot','Sometimes','I did not use it']),
(7, 'learning', 'What was your main strategy?', ARRAY['Mostly cash','A balanced mix','Mostly shares']),
(8, 'learning', 'Did you learn to keep a cash and share buffer for surprises?', ARRAY['Yes, always','I learned the hard way','Not really']),
(9, 'learning', 'Did you manage to buy low and sell high?', ARRAY['Yes, often','A few times','No, I bought high']),
(10, 'learning', 'Did the game help you feel how the market moves?', ARRAY['Strongly agree','Somewhat','Not yet']);