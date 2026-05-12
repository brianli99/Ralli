-- ============================================================================
-- Atomic Session RSVP Updates
-- ============================================================================
-- Keeps sessions.current_players accurate when multiple users RSVP at once.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_participants_session_user_unique'
      AND conrelid = 'public.session_participants'::regclass
  ) THEN
    ALTER TABLE public.session_participants
      ADD CONSTRAINT session_participants_session_user_unique UNIQUE (session_id, user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rsvp_to_session(
  p_session_id UUID,
  p_status TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_in_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_status NOT IN ('in', 'out', 'maybe') THEN
    RAISE EXCEPTION 'Invalid RSVP status' USING ERRCODE = '22023';
  END IF;

  SELECT id, max_players
    INTO v_session
    FROM public.sessions
    WHERE id = p_session_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_status = 'in' AND COALESCE(v_session.max_players, 0) > 0 THEN
    SELECT COUNT(*)
      INTO v_in_count
      FROM public.session_participants
      WHERE session_id = p_session_id
        AND status = 'in'
        AND user_id <> v_user_id;

    IF v_in_count >= v_session.max_players THEN
      RAISE EXCEPTION 'Session is full' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.session_participants (session_id, user_id, status)
    VALUES (p_session_id, v_user_id, p_status)
    ON CONFLICT (session_id, user_id)
    DO UPDATE SET status = EXCLUDED.status;

  SELECT COUNT(*)
    INTO v_in_count
    FROM public.session_participants
    WHERE session_id = p_session_id
      AND status = 'in';

  UPDATE public.sessions
    SET current_players = v_in_count
    WHERE id = p_session_id;

  RETURN v_in_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rsvp_to_session(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rsvp_to_session(UUID, TEXT) TO authenticated;
