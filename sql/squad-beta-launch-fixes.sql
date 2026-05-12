-- ============================================================================
-- Squad Beta Launch Fixes
-- ============================================================================
-- Fixes schema drift for supported sports and tightens squad member RLS.

CREATE OR REPLACE FUNCTION public.can_manage_squad_members(
  check_squad_id UUID,
  check_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.squads
    WHERE id = check_squad_id
      AND owner_id = check_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.squad_members
    WHERE squad_id = check_squad_id
      AND user_id = check_user_id
      AND role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_squad_members(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_squad_members(UUID, UUID) TO authenticated;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  IF to_regclass('public.squads') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname
    INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.squads'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%sport_code%'
    LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.squads DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.squads
    ADD CONSTRAINT squads_sport_code_check
    CHECK (sport_code IN ('basketball','tennis','pickleball','volleyball','running','soccer','badminton'));
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  IF to_regclass('public.matches') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname
    INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.matches'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%sport_code%'
    LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.matches
    ADD CONSTRAINT matches_sport_code_check
    CHECK (sport_code IN ('basketball','tennis','pickleball','volleyball','running','soccer','badminton'));
END $$;

DROP POLICY IF EXISTS "Users can join or be added to squads" ON public.squad_members;
DROP POLICY IF EXISTS "Users can update squad membership" ON public.squad_members;
DROP POLICY IF EXISTS "Users can leave or be removed from squads" ON public.squad_members;

CREATE POLICY "Users can join or be added to squads"
ON public.squad_members
FOR INSERT
WITH CHECK (
  (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.squads
      WHERE id = squad_members.squad_id
        AND is_private = FALSE
    )
  )
  OR public.can_manage_squad_members(squad_id, auth.uid())
);

CREATE POLICY "Users can update squad membership"
ON public.squad_members
FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.can_manage_squad_members(squad_id, auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR public.can_manage_squad_members(squad_id, auth.uid())
);

CREATE POLICY "Users can leave or be removed from squads"
ON public.squad_members
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.can_manage_squad_members(squad_id, auth.uid())
);
