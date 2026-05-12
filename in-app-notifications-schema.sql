-- ============================================
-- In-App Notifications Schema
-- Run this in your Supabase SQL editor to enable
-- the in-app notification center (invites, session
-- updates, waitlist promotion, etc).
-- ============================================

CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  ON app_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
  ON app_notifications(user_id, read, created_at DESC);

-- RLS
ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON app_notifications;
CREATE POLICY "Users read own notifications" ON app_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON app_notifications;
CREATE POLICY "Users update own notifications" ON app_notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own notifications" ON app_notifications;
CREATE POLICY "Users delete own notifications" ON app_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Allow any authenticated user to insert notifications
-- (needed for e.g. cancelling a session → notify all RSVPs)
DROP POLICY IF EXISTS "Authenticated insert notifications" ON app_notifications;
CREATE POLICY "Authenticated insert notifications" ON app_notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;

-- ============================================
-- Waitlist promotion RPC
-- When someone drops from a session, call this to
-- promote the next waitlisted user and notify them.
-- ============================================
CREATE OR REPLACE FUNCTION promote_waitlist(p_session_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_user UUID;
  v_session RECORD;
BEGIN
  SELECT id, title, max_players, current_players, scheduled_for
    INTO v_session
    FROM sessions
    WHERE id = p_session_id;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_session.current_players >= v_session.max_players THEN RETURN NULL; END IF;

  -- Pick the earliest waitlisted user
  SELECT user_id INTO v_next_user
    FROM session_waitlist
    WHERE session_id = p_session_id
      AND status = 'waiting'
    ORDER BY position ASC, created_at ASC
    LIMIT 1;

  IF v_next_user IS NULL THEN RETURN NULL; END IF;

  -- Mark waitlist as promoted
  UPDATE session_waitlist
    SET status = 'promoted'
    WHERE session_id = p_session_id AND user_id = v_next_user;

  -- Insert participant
  INSERT INTO session_participants (session_id, user_id, status)
    VALUES (p_session_id, v_next_user, 'in')
    ON CONFLICT (session_id, user_id) DO UPDATE SET status = 'in';

  -- Bump count
  UPDATE sessions
    SET current_players = current_players + 1
    WHERE id = p_session_id;

  -- Notify the user
  INSERT INTO app_notifications (user_id, type, title, body, data)
    VALUES (
      v_next_user,
      'waitlist_promoted',
      'You''re in! 🎉',
      format('A spot opened in "%s". You''ve been moved from the waitlist.', v_session.title),
      jsonb_build_object('session_id', p_session_id)
    );

  RETURN v_next_user;
END;
$$;
