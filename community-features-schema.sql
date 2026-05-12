-- ============================================================================
-- RALLI COMMUNITY FEATURES - DATABASE SCHEMA
-- Run in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. COURT CHAT (Location-based messaging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS court_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_place_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'session_link', 'crew_announcement', 'challenge')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_messages_place ON court_messages(google_place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_court_messages_user ON court_messages(user_id);

ALTER TABLE court_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read court messages" ON court_messages;
CREATE POLICY "Anyone can read court messages"
  ON court_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post court messages" ON court_messages;
CREATE POLICY "Authenticated users can post court messages"
  ON court_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own court messages" ON court_messages;
CREATE POLICY "Users can delete own court messages"
  ON court_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. CREWS (Location-based teams)
-- ============================================================================

CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  google_place_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  captain_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  is_open BOOLEAN DEFAULT TRUE,
  max_members INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crews_place ON crews(google_place_id);
CREATE INDEX IF NOT EXISTS idx_crews_sport ON crews(sport);
CREATE INDEX IF NOT EXISTS idx_crews_captain ON crews(captain_id);

ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view crews" ON crews;
CREATE POLICY "Anyone can view crews"
  ON crews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create crews" ON crews;
CREATE POLICY "Authenticated users can create crews"
  ON crews FOR INSERT
  WITH CHECK (auth.uid() = captain_id);

DROP POLICY IF EXISTS "Captain can update crew" ON crews;
CREATE POLICY "Captain can update crew"
  ON crews FOR UPDATE
  USING (auth.uid() = captain_id);

DROP POLICY IF EXISTS "Captain can delete crew" ON crews;
CREATE POLICY "Captain can delete crew"
  ON crews FOR DELETE
  USING (auth.uid() = captain_id);

-- ============================================================================
-- 3. CREW MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS crew_members (
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('captain', 'co-captain', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (crew_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_members_user ON crew_members(user_id);

ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view crew members" ON crew_members;
CREATE POLICY "Anyone can view crew members"
  ON crew_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join open crews" ON crew_members;
CREATE POLICY "Users can join open crews"
  ON crew_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave crews" ON crew_members;
CREATE POLICY "Users can leave crews"
  ON crew_members FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CREW CHALLENGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS crew_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenger_crew_id UUID REFERENCES crews(id) ON DELETE CASCADE NOT NULL,
  challenged_crew_id UUID REFERENCES crews(id) ON DELETE CASCADE NOT NULL,
  google_place_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  proposed_time TIMESTAMPTZ NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  winner_crew_id UUID REFERENCES crews(id),
  challenger_score INTEGER,
  challenged_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (challenger_crew_id != challenged_crew_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON crew_challenges(challenger_crew_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON crew_challenges(challenged_crew_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON crew_challenges(status);

ALTER TABLE crew_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view challenges" ON crew_challenges;
CREATE POLICY "Anyone can view challenges"
  ON crew_challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Crew captains can create challenges" ON crew_challenges;
CREATE POLICY "Crew captains can create challenges"
  ON crew_challenges FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT captain_id FROM crews WHERE id = challenger_crew_id
  ));

DROP POLICY IF EXISTS "Involved captains can update challenges" ON crew_challenges;
CREATE POLICY "Involved captains can update challenges"
  ON crew_challenges FOR UPDATE
  USING (auth.uid() IN (
    SELECT captain_id FROM crews WHERE id IN (challenger_crew_id, challenged_crew_id)
  ));

-- ============================================================================
-- 5. CREW WIN/LOSS RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_crew_wins(crew_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE crews SET wins = wins + 1, updated_at = NOW() WHERE id = crew_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_crew_losses(crew_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE crews SET losses = losses + 1, updated_at = NOW() WHERE id = crew_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. NOTIFICATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'expo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  session_reminders BOOLEAN DEFAULT TRUE,
  friend_requests BOOLEAN DEFAULT TRUE,
  squad_invites BOOLEAN DEFAULT TRUE,
  chat_messages BOOLEAN DEFAULT TRUE,
  check_in_nearby BOOLEAN DEFAULT TRUE,
  marketing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification prefs" ON notification_preferences;
CREATE POLICY "Users manage own notification prefs"
  ON notification_preferences FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 7. FIX SQUAD SCHEMA: ADD BADMINTON TO CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE squads DROP CONSTRAINT IF EXISTS squads_sport_code_check;
ALTER TABLE squads ADD CONSTRAINT squads_sport_code_check
  CHECK (sport_code IN ('basketball','tennis','pickleball','volleyball','running','soccer','badminton'));

-- Also update matches if exists
DO $$ BEGIN
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_sport_code_check;
  ALTER TABLE matches ADD CONSTRAINT matches_sport_code_check
    CHECK (sport_code IN ('basketball','tennis','pickleball','volleyball','running','soccer','badminton'));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================================
-- 8. ENABLE REALTIME
-- ============================================================================

DO $$ BEGIN
  ALTER publication supabase_realtime ADD TABLE court_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER publication supabase_realtime ADD TABLE crew_challenges;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
