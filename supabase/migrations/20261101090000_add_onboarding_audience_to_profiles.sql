ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS study_level text,
  ADD COLUMN IF NOT EXISTS exam_class text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.primary_goal IS 'Main RuJe IA service selected during onboarding';
COMMENT ON COLUMN public.profiles.study_level IS 'Education level selected during onboarding';
COMMENT ON COLUMN public.profiles.exam_class IS 'Exam class selected during onboarding';
