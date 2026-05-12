-- ============================================================================
-- RALLI BETA FEATURES - DATABASE SCHEMA UPDATE
-- Run in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. WAITLIST SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'declined', 'expired')),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_session ON session_waitlist(session_id, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON session_waitlist(user_id);

-- RLS policies for waitlist
ALTER TABLE session_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view waitlist for sessions" ON session_waitlist;
CREATE POLICY "Users can view waitlist for sessions"
  ON session_waitlist FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can join waitlist" ON session_waitlist;
CREATE POLICY "Users can join waitlist"
  ON session_waitlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own waitlist entry" ON session_waitlist;
CREATE POLICY "Users can update own waitlist entry"
  ON session_waitlist FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave waitlist" ON session_waitlist;
CREATE POLICY "Users can leave waitlist"
  ON session_waitlist FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. RECURRING SESSIONS
-- ============================================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
-- Format: 'weekly', 'biweekly', or null for one-time
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;
-- Links recurring instances back to the template

-- ============================================================================
-- 3. SKILL LEVEL PER SPORT (on user profile)
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_levels JSONB DEFAULT '{}';
-- Format: {"basketball": "intermediate", "tennis": "beginner", ...}

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS skill_level TEXT;

-- ============================================================================
-- 4. SAVED/FAVORITE COURTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_place_id TEXT NOT NULL,
  facility_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_place_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON user_favorites;
CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add favorites" ON user_favorites;
CREATE POLICY "Users can add favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove favorites" ON user_favorites;
CREATE POLICY "Users can remove favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. ENABLE REALTIME FOR NEW TABLES
-- ============================================================================

DO $$ BEGIN
  ALTER publication supabase_realtime ADD TABLE session_waitlist;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER publication supabase_realtime ADD TABLE user_favorites;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
