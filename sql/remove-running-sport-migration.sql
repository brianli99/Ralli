-- =============================================================================
-- Remove legacy sport code 'running' from data and constraints
-- Run in Supabase SQL editor (or psql) after review. Adjust replacement sport
-- ('soccer' below) if you prefer another default for migrated rows.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Rewrite row-level sport values (tables commonly used by the app)
-- ---------------------------------------------------------------------------

UPDATE public.check_ins SET sport = 'soccer' WHERE sport = 'running';
UPDATE public.sessions SET sport = 'soccer' WHERE sport = 'running';

-- facility_capacity: UNIQUE(google_place_id, sport) — cannot UPDATE running→soccer if soccer row exists.
-- Merge counts into the existing soccer row, drop running rows that have a soccer twin, then rename orphans.
UPDATE public.facility_capacity AS s
SET
  current_players = s.current_players + r.current_players,
  max_capacity = GREATEST(s.max_capacity, r.max_capacity),
  last_updated = GREATEST(s.last_updated, r.last_updated)
FROM public.facility_capacity AS r
WHERE r.sport = 'running'
  AND s.google_place_id = r.google_place_id
  AND s.sport = 'soccer';

DELETE FROM public.facility_capacity AS r
USING public.facility_capacity AS s
WHERE r.sport = 'running'
  AND s.google_place_id = r.google_place_id
  AND s.sport = 'soccer';

UPDATE public.facility_capacity SET sport = 'soccer' WHERE sport = 'running';

-- Squads (MVP schema uses sport_code)
UPDATE public.squads SET sport_code = 'soccer' WHERE sport_code = 'running';

-- Crews (community schema uses sport, not sport_code)
UPDATE public.crews SET sport = 'soccer' WHERE sport = 'running';

-- ---------------------------------------------------------------------------
-- 2) User preference arrays: remove 'running' (PostgreSQL text[])
-- ---------------------------------------------------------------------------

UPDATE public.users
SET preferred_sports = array_remove(preferred_sports, 'running')
WHERE 'running' = ANY (preferred_sports);

UPDATE public.users
SET sport_preference_order = array_remove(sport_preference_order, 'running')
WHERE 'running' = ANY (sport_preference_order);

-- ---------------------------------------------------------------------------
-- 3) Constraints: drop and recreate without 'running'
--    (Names may differ — inspect pg_constraint if these fail.)
-- ---------------------------------------------------------------------------

-- Example for a table with CHECK (sport IN (...)):
-- ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_sport_check;
-- ALTER TABLE public.sessions ADD CONSTRAINT sessions_sport_check
--   CHECK (sport IN ('basketball','tennis','pickleball','volleyball','soccer','badminton'));

-- If you use sport_code on squads:
-- ALTER TABLE public.squads DROP CONSTRAINT IF EXISTS squads_sport_code_check;
-- ALTER TABLE public.squads ADD CONSTRAINT squads_sport_code_check
--   CHECK (sport_code IN ('basketball','tennis','pickleball','volleyball','soccer','badminton'));

-- Uncomment and adapt the above after: \d+ your_table in psql to see exact constraint names.

COMMIT;

-- After migration, regenerate src/types/database.types.ts if you use Supabase CLI types.
