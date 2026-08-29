-- Column-level restriction so email is never readable through the Data API.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, onboarded, target_titles, employment_types, work_modes, countries,
  min_salary, salary_period, salary_currency, experience_level, industries, skills,
  created_at, updated_at, nickname, normalized_nickname, avatar_path, headline,
  career_interests, public_profile, show_location, location, last_visit_at, previous_visit_at)
  ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Reactions from blocked users stay hidden, consistent with posts/comments.
DROP POLICY IF EXISTS "reactions readable" ON public.community_reactions;
CREATE POLICY "reactions readable" ON public.community_reactions
  FOR SELECT TO authenticated
  USING (NOT public.is_blocked(auth.uid(), user_id));