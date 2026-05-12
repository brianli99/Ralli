-- ============================================================================
-- RALLI SQUAD SYSTEM - SAFE SCHEMA FIX
-- ============================================================================
-- This version drops existing policies before recreating them to avoid conflicts
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. SQUADS & MEMBERSHIP SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS squads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sport_code TEXT NOT NULL CHECK (sport_code IN ('basketball','tennis','pickleball','volleyball','running','soccer')),
  description TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  theme_color TEXT DEFAULT '#1a73e8',
  is_private BOOLEAN DEFAULT FALSE,
  max_members INTEGER,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squad_members (
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  position TEXT,
  jersey_number INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (squad_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squads_sport ON squads(sport_code);
CREATE INDEX IF NOT EXISTS idx_squads_owner ON squads(owner_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);

-- ============================================================================
-- 2. FRIENDSHIP SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- ============================================================================
-- 3. MATCHES & SCHEDULING SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  sport_code TEXT NOT NULL CHECK (sport_code IN ('basketball','tennis','pickleball','volleyball','running','soccer')),
  match_type TEXT NOT NULL DEFAULT 'friendly' CHECK (match_type IN ('friendly','tournament','league','practice')),
  facility_id TEXT,
  facility_name TEXT,
  custom_location TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  sport_settings JSONB DEFAULT '{}',
  description TEXT,
  max_participants INTEGER,
  is_private BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  result JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_side INTEGER DEFAULT 1,
  is_host BOOLEAN DEFAULT FALSE,
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('pending','accepted','declined','maybe')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (squad_id IS NOT NULL AND user_id IS NULL) OR 
    (squad_id IS NULL AND user_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS match_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CHECK (
    (to_squad_id IS NOT NULL AND to_user_id IS NULL) OR 
    (to_squad_id IS NULL AND to_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_matches_sport ON matches(sport_code);
CREATE INDEX IF NOT EXISTS idx_matches_scheduled ON matches(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_matches_creator ON matches(created_by);
CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_squad ON match_participants(squad_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_match_invitations_match ON match_invitations(match_id);

-- ============================================================================
-- 4. MESSAGING SYSTEM (Squad Chat + DMs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS squad_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','image','match_invite','system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS direct_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_a < user_b),
  UNIQUE(user_a, user_b)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES direct_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','image','match_invite','system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS direct_threads_read (
  thread_id UUID REFERENCES direct_threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_messages_squad ON squad_messages(squad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_squad_messages_sender ON squad_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_thread ON direct_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_threads_users ON direct_threads(user_a, user_b);

-- ============================================================================
-- 5. USER QR CODES & DISCOVERY
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_qr_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  qr_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_threads_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_qr_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. DROP EXISTING POLICIES (to avoid conflicts)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible squads" ON squads;
DROP POLICY IF EXISTS "Users can create squads" ON squads;
DROP POLICY IF EXISTS "Owners and admins can update squads" ON squads;
DROP POLICY IF EXISTS "Owners can delete squads" ON squads;

DROP POLICY IF EXISTS "Users can view squad members" ON squad_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON squad_members;
DROP POLICY IF EXISTS "Users can update squad membership" ON squad_members;
DROP POLICY IF EXISTS "Users can leave or be removed from squads" ON squad_members;

DROP POLICY IF EXISTS "Users can view their friendships" ON friendships;
DROP POLICY IF EXISTS "Users can send friend requests" ON friendships;
DROP POLICY IF EXISTS "Users can update their friendships" ON friendships;
DROP POLICY IF EXISTS "Users can delete their friendships" ON friendships;

DROP POLICY IF EXISTS "Squad members can view squad messages" ON squad_messages;
DROP POLICY IF EXISTS "Squad members can send messages" ON squad_messages;

DROP POLICY IF EXISTS "Users can view their direct threads" ON direct_threads;
DROP POLICY IF EXISTS "Users can create direct threads" ON direct_threads;

DROP POLICY IF EXISTS "Users can view direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;

DROP POLICY IF EXISTS "Users can manage their read status" ON direct_threads_read;

DROP POLICY IF EXISTS "Users can manage their QR codes" ON user_qr_codes;
DROP POLICY IF EXISTS "QR codes are publicly readable" ON user_qr_codes;

-- ============================================================================
-- 8. CREATE POLICIES
-- ============================================================================

-- SQUADS POLICIES
CREATE POLICY "Users can view accessible squads" ON squads FOR SELECT USING (
  NOT is_private OR 
  EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_members.squad_id = squads.id 
    AND squad_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create squads" ON squads FOR INSERT WITH CHECK (
  auth.uid() = owner_id
);

CREATE POLICY "Owners and admins can update squads" ON squads FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_members.squad_id = squads.id 
    AND squad_members.user_id = auth.uid() 
    AND squad_members.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners can delete squads" ON squads FOR DELETE USING (
  owner_id = auth.uid()
);

-- SQUAD MEMBERS POLICIES
CREATE POLICY "Users can view squad members" ON squad_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM squad_members sm 
    WHERE sm.squad_id = squad_members.squad_id 
    AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "Owners and admins can add members" ON squad_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_members.squad_id = squad_members.squad_id 
    AND squad_members.user_id = auth.uid() 
    AND squad_members.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can update squad membership" ON squad_members FOR UPDATE USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM squad_members sm 
    WHERE sm.squad_id = squad_members.squad_id 
    AND sm.user_id = auth.uid() 
    AND sm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can leave or be removed from squads" ON squad_members FOR DELETE USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM squad_members sm 
    WHERE sm.squad_id = squad_members.squad_id 
    AND sm.user_id = auth.uid() 
    AND sm.role IN ('owner', 'admin')
  )
);

-- FRIENDSHIPS POLICIES
CREATE POLICY "Users can view their friendships" ON friendships FOR SELECT USING (
  user_id = auth.uid() OR friend_id = auth.uid()
);

CREATE POLICY "Users can send friend requests" ON friendships FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Users can update their friendships" ON friendships FOR UPDATE USING (
  user_id = auth.uid() OR friend_id = auth.uid()
);

CREATE POLICY "Users can delete their friendships" ON friendships FOR DELETE USING (
  user_id = auth.uid() OR friend_id = auth.uid()
);

-- SQUAD MESSAGES POLICIES
CREATE POLICY "Squad members can view squad messages" ON squad_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_members.squad_id = squad_messages.squad_id 
    AND squad_members.user_id = auth.uid()
  )
);

CREATE POLICY "Squad members can send messages" ON squad_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_members.squad_id = squad_messages.squad_id 
    AND squad_members.user_id = auth.uid()
  )
);

-- DIRECT THREADS POLICIES
CREATE POLICY "Users can view their direct threads" ON direct_threads FOR SELECT USING (
  user_a = auth.uid() OR user_b = auth.uid()
);

CREATE POLICY "Users can create direct threads" ON direct_threads FOR INSERT WITH CHECK (
  user_a = auth.uid() OR user_b = auth.uid()
);

-- DIRECT MESSAGES POLICIES
CREATE POLICY "Users can view direct messages" ON direct_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM direct_threads 
    WHERE direct_threads.id = direct_messages.thread_id 
    AND (direct_threads.user_a = auth.uid() OR direct_threads.user_b = auth.uid())
  )
);

CREATE POLICY "Users can send direct messages" ON direct_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM direct_threads 
    WHERE direct_threads.id = direct_messages.thread_id 
    AND (direct_threads.user_a = auth.uid() OR direct_threads.user_b = auth.uid())
  )
);

-- DIRECT THREADS READ POLICY
CREATE POLICY "Users can manage their read status" ON direct_threads_read FOR ALL USING (
  user_id = auth.uid()
);

-- QR CODES POLICIES
CREATE POLICY "Users can manage their QR codes" ON user_qr_codes FOR ALL USING (
  user_id = auth.uid()
);

CREATE POLICY "QR codes are publicly readable" ON user_qr_codes FOR SELECT USING (true);

-- ============================================================================
-- 9. REALTIME SUBSCRIPTIONS (ignore errors if already added)
-- ============================================================================

DO $$
BEGIN
  ALTER publication supabase_realtime ADD TABLE squad_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER publication supabase_realtime ADD TABLE direct_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER publication supabase_realtime ADD TABLE match_invitations;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER publication supabase_realtime ADD TABLE squad_members;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================================
-- 10. FUNCTIONS AND TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_squads_updated_at ON squads;
DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
DROP TRIGGER IF EXISTS update_squad_messages_updated_at ON squad_messages;
DROP TRIGGER IF EXISTS update_direct_messages_updated_at ON direct_messages;

CREATE TRIGGER update_squads_updated_at BEFORE UPDATE ON squads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_squad_messages_updated_at BEFORE UPDATE ON squad_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_direct_messages_updated_at BEFORE UPDATE ON direct_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'Schema setup complete! Tables created: squads, squad_members, friendships, matches, match_participants, match_invitations, squad_messages, direct_threads, direct_messages, direct_threads_read, user_qr_codes' as status;
