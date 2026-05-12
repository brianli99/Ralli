-- ============================================================================
-- Ralli Beta Schema Consolidated Migration
-- ============================================================================
-- Run after the base MVP schema. This file consolidates the beta/runtime SQL
-- that the current app depends on and is safe to re-run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Session location, recurrence, waitlist, and atomic RSVP support
-- ----------------------------------------------------------------------------

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS skill_level TEXT,
  ADD COLUMN IF NOT EXISTS host_name TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.session_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'declined', 'expired')),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_session ON public.session_waitlist(session_id, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON public.session_waitlist(user_id);
ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view waitlist for sessions" ON public.session_waitlist;
CREATE POLICY "Users can view waitlist for sessions"
  ON public.session_waitlist FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join waitlist" ON public.session_waitlist;
CREATE POLICY "Users can join waitlist"
  ON public.session_waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own waitlist entry" ON public.session_waitlist;
CREATE POLICY "Users can update own waitlist entry"
  ON public.session_waitlist FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave waitlist" ON public.session_waitlist;
CREATE POLICY "Users can leave waitlist"
  ON public.session_waitlist FOR DELETE USING (auth.uid() = user_id);

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

-- ----------------------------------------------------------------------------
-- Check-in presence and favorites
-- ----------------------------------------------------------------------------

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS place_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS place_longitude DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_place_id TEXT NOT NULL,
  facility_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_place_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.user_favorites(user_id);
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON public.user_favorites;
CREATE POLICY "Users can view own favorites"
  ON public.user_favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add favorites" ON public.user_favorites;
CREATE POLICY "Users can add favorites"
  ON public.user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove favorites" ON public.user_favorites;
CREATE POLICY "Users can remove favorites"
  ON public.user_favorites FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'expo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
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

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users manage own notification prefs"
  ON public.notification_preferences FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'session_cancelled',
    'session_reminder',
    'session_updated',
    'waitlist_promoted',
    'friend_request',
    'friend_accepted',
    'squad_invite',
    'squad_joined',
    'new_message',
    'generic'
  )),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON public.app_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
  ON public.app_notifications(user_id, read, created_at DESC);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.app_notifications;
CREATE POLICY "Users read own notifications"
  ON public.app_notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own notifications" ON public.app_notifications;
CREATE POLICY "Users update own notifications"
  ON public.app_notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own notifications" ON public.app_notifications;
CREATE POLICY "Users delete own notifications"
  ON public.app_notifications FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.app_notifications;
CREATE POLICY "Authenticated insert notifications"
  ON public.app_notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- Social feed
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feed_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('game_completed', 'squad_joined', 'match_won', 'achievement_unlocked', 'check_in')),
  activity_data JSONB NOT NULL DEFAULT '{}',
  related_match_id UUID,
  related_squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL,
  related_facility_id TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feed_activities
  ADD COLUMN IF NOT EXISTS activity_data JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_facility_id TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.activity_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES public.feed_activities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.activity_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES public.feed_activities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_activities_user ON public.feed_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_activities_public ON public.feed_activities(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_likes_activity ON public.activity_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_activity ON public.activity_comments(activity_id, created_at DESC);

ALTER TABLE public.feed_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public activities and friend activities" ON public.feed_activities;
CREATE POLICY "Users can view public activities and friend activities"
  ON public.feed_activities FOR SELECT USING (is_public = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own activities" ON public.feed_activities;
CREATE POLICY "Users can create their own activities"
  ON public.feed_activities FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can like/unlike activities" ON public.activity_likes;
CREATE POLICY "Users can like/unlike activities"
  ON public.activity_likes FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view likes on visible activities" ON public.activity_likes;
CREATE POLICY "Users can view likes on visible activities"
  ON public.activity_likes FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.feed_activities
      WHERE feed_activities.id = activity_likes.activity_id
        AND (feed_activities.is_public = true OR feed_activities.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view comments on visible activities" ON public.activity_comments;
CREATE POLICY "Users can view comments on visible activities"
  ON public.activity_comments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.feed_activities
      WHERE feed_activities.id = activity_comments.activity_id
        AND (feed_activities.is_public = true OR feed_activities.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can comment on visible activities" ON public.activity_comments;
CREATE POLICY "Users can comment on visible activities"
  ON public.activity_comments FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.feed_activities
      WHERE feed_activities.id = activity_comments.activity_id
        AND (feed_activities.is_public = true OR feed_activities.user_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.update_activity_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'activity_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.feed_activities
        SET likes_count = likes_count + 1, updated_at = NOW()
        WHERE id = NEW.activity_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.feed_activities
        SET likes_count = GREATEST(likes_count - 1, 0), updated_at = NOW()
        WHERE id = OLD.activity_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'activity_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.feed_activities
        SET comments_count = comments_count + 1, updated_at = NOW()
        WHERE id = NEW.activity_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.feed_activities
        SET comments_count = GREATEST(comments_count - 1, 0), updated_at = NOW()
        WHERE id = OLD.activity_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_likes_count ON public.activity_likes;
CREATE TRIGGER update_activity_likes_count
  AFTER INSERT OR DELETE ON public.activity_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_activity_counts();

DROP TRIGGER IF EXISTS update_activity_comments_count ON public.activity_comments;
CREATE TRIGGER update_activity_comments_count
  AFTER INSERT OR DELETE ON public.activity_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_activity_counts();

-- ----------------------------------------------------------------------------
-- Court chat and crews
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.court_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_place_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'session_link', 'crew_announcement', 'challenge')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_messages_place ON public.court_messages(google_place_id, created_at DESC);
ALTER TABLE public.court_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read court messages" ON public.court_messages;
CREATE POLICY "Anyone can read court messages" ON public.court_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can post court messages" ON public.court_messages;
CREATE POLICY "Authenticated users can post court messages"
  ON public.court_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.crews (
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

CREATE INDEX IF NOT EXISTS idx_crews_place ON public.crews(google_place_id);
CREATE INDEX IF NOT EXISTS idx_crews_sport ON public.crews(sport);
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view crews" ON public.crews;
CREATE POLICY "Anyone can view crews" ON public.crews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create crews" ON public.crews;
CREATE POLICY "Authenticated users can create crews"
  ON public.crews FOR INSERT WITH CHECK (auth.uid() = captain_id);
DROP POLICY IF EXISTS "Captain can update crew" ON public.crews;
CREATE POLICY "Captain can update crew" ON public.crews FOR UPDATE USING (auth.uid() = captain_id);
DROP POLICY IF EXISTS "Captain can delete crew" ON public.crews;
CREATE POLICY "Captain can delete crew" ON public.crews FOR DELETE USING (auth.uid() = captain_id);

CREATE TABLE IF NOT EXISTS public.crew_members (
  crew_id UUID REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('captain', 'co-captain', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (crew_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_members_user ON public.crew_members(user_id);
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view crew members" ON public.crew_members;
CREATE POLICY "Anyone can view crew members" ON public.crew_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can join open crews" ON public.crew_members;
CREATE POLICY "Users can join open crews"
  ON public.crew_members FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can leave crews" ON public.crew_members;
CREATE POLICY "Users can leave crews" ON public.crew_members FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.crew_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenger_crew_id UUID REFERENCES public.crews(id) ON DELETE CASCADE NOT NULL,
  challenged_crew_id UUID REFERENCES public.crews(id) ON DELETE CASCADE NOT NULL,
  google_place_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  proposed_time TIMESTAMPTZ NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  winner_crew_id UUID REFERENCES public.crews(id),
  challenger_score INTEGER,
  challenged_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (challenger_crew_id != challenged_crew_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON public.crew_challenges(challenger_crew_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON public.crew_challenges(challenged_crew_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.crew_challenges(status);
ALTER TABLE public.crew_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view challenges" ON public.crew_challenges;
CREATE POLICY "Anyone can view challenges" ON public.crew_challenges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Crew captains can create challenges" ON public.crew_challenges;
CREATE POLICY "Crew captains can create challenges"
  ON public.crew_challenges FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT captain_id FROM public.crews WHERE id = challenger_crew_id)
  );
DROP POLICY IF EXISTS "Involved captains can update challenges" ON public.crew_challenges;
CREATE POLICY "Involved captains can update challenges"
  ON public.crew_challenges FOR UPDATE USING (
    auth.uid() IN (SELECT captain_id FROM public.crews WHERE id IN (challenger_crew_id, challenged_crew_id))
  );

CREATE OR REPLACE FUNCTION public.increment_crew_wins(crew_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.crews SET wins = wins + 1, updated_at = NOW() WHERE id = crew_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_crew_losses(crew_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.crews SET losses = losses + 1, updated_at = NOW() WHERE id = crew_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_crew_wins(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_crew_losses(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- Squad beta fixes
-- ----------------------------------------------------------------------------

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
    SELECT 1 FROM public.squads
    WHERE id = check_squad_id AND owner_id = check_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.squad_members
    WHERE squad_id = check_squad_id
      AND user_id = check_user_id
      AND role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_squad_members(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_squad_members(UUID, UUID) TO authenticated;

ALTER TABLE public.squad_members ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.squad_members ADD COLUMN IF NOT EXISTS jersey_number INTEGER;
ALTER TABLE public.squad_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
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

-- ----------------------------------------------------------------------------
-- Realtime publication best-effort additions
-- ----------------------------------------------------------------------------

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_waitlist; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_favorites; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_activities; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_likes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.court_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_challenges; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
