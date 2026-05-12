-- ============================================================================
-- Check-in presence: active session, idempotent check-in, auto-checkout support
-- Run in Supabase SQL editor. Safe to re-run (IF NOT EXISTS / OR REPLACE).
-- ============================================================================

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS place_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS place_longitude DOUBLE PRECISION;

-- Close historical open-ended rows (pre-migration) so partial unique is valid
UPDATE public.check_ins
SET
  checked_out_at = created_at,
  last_heartbeat_at = COALESCE(last_heartbeat_at, created_at)
WHERE checked_out_at IS NULL;

-- At most one active (not checked out) check-in per user
DROP INDEX IF EXISTS idx_check_ins_one_active_per_user;
CREATE UNIQUE INDEX idx_check_ins_one_active_per_user
  ON public.check_ins (user_id)
  WHERE checked_out_at IS NULL;

-- RLS: allow users to update their own rows (checkout / heartbeat) — RPC uses SECURITY DEFINER
DROP POLICY IF EXISTS "Users can update their own check-ins" ON public.check_ins;
CREATE POLICY "Users can update their own check-ins"
  ON public.check_ins
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Idempotent check-in: one global active presence; switch venue closes previous
CREATE OR REPLACE FUNCTION public.check_in_at_court(
  p_google_place_id text,
  p_sport text,
  p_user_lat double precision,
  p_user_lng double precision,
  p_place_lat double precision,
  p_place_lng double precision
) RETURNS public.check_ins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.check_ins%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.check_ins
  SET
    checked_out_at = now(),
    last_heartbeat_at = now()
  WHERE user_id = v_uid
    AND checked_out_at IS NULL
    AND google_place_id IS DISTINCT FROM p_google_place_id;

  SELECT * INTO v_row
  FROM public.check_ins
  WHERE user_id = v_uid
    AND checked_out_at IS NULL
    AND google_place_id = p_google_place_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.check_ins
    SET
      sport = p_sport,
      latitude = p_user_lat,
      longitude = p_user_lng,
      place_latitude = p_place_lat,
      place_longitude = p_place_lng,
      last_heartbeat_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  INSERT INTO public.check_ins (
    user_id, google_place_id, sport,
    latitude, longitude,
    place_latitude, place_longitude,
    last_heartbeat_at
  ) VALUES (
    v_uid, p_google_place_id, p_sport,
    p_user_lat, p_user_lng,
    p_place_lat, p_place_lng,
    now()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_at_court(
  text, text, double precision, double precision, double precision, double precision
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_at_court(
  text, text, double precision, double precision, double precision, double precision
) TO service_role;

CREATE OR REPLACE FUNCTION public.check_out_court()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.check_ins
  SET
    checked_out_at = now(),
    last_heartbeat_at = now()
  WHERE user_id = v_uid
    AND checked_out_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_out_court() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_court() TO service_role;
