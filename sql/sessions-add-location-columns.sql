-- Align public.sessions with app types (src/types/database.types.ts).
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- Fixes: "Could not find the 'latitude' column of 'sessions' in the schema cache"

-- Location (Nearby tab, create session insert)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Other columns expected by Row/Insert types but omitted from older mvp-database-setup.sql
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS skill_level TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS host_name TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL;

-- Optional: comment for operators
COMMENT ON COLUMN public.sessions.latitude IS 'Facility/court latitude for distance sorting (e.g. Sessions Nearby).';
COMMENT ON COLUMN public.sessions.longitude IS 'Facility/court longitude for distance sorting.';
COMMENT ON COLUMN public.sessions.location_name IS 'Human-readable venue name from map/Places.';
