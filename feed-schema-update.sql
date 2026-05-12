-- ============================================================================
-- RALLI SOCIAL FEED SYSTEM - DATABASE SCHEMA UPDATE
-- ============================================================================
-- Features: Activity feed, likes, comments, friend activity tracking
-- ============================================================================

-- ============================================================================
-- 1. ACTIVITY FEED SYSTEM
-- ============================================================================

-- Activity feed entries (friend activities, game completions, squad joins, etc.)
CREATE TABLE IF NOT EXISTS feed_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('game_completed', 'squad_joined', 'match_won', 'achievement_unlocked', 'check_in')),
  
  -- Activity metadata (JSON for flexibility)
  activity_data JSONB NOT NULL DEFAULT '{}', -- Contains sport, location, details, etc.
  
  -- Related entities
  related_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  related_squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
  related_facility_id TEXT, -- Google Places ID
  
  -- Visibility and engagement
  is_public BOOLEAN DEFAULT TRUE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity likes (who liked what)
CREATE TABLE IF NOT EXISTS activity_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES feed_activities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- Activity comments
CREATE TABLE IF NOT EXISTS activity_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES feed_activities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. FRIEND REQUESTS ENHANCEMENT
-- ============================================================================

-- Add friend request notifications/tracking
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  UNIQUE(from_user_id, to_user_id)
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Feed activity indexes
CREATE INDEX IF NOT EXISTS idx_feed_activities_user ON feed_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_activities_public ON feed_activities(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_activities_type ON feed_activities(activity_type, created_at DESC);

-- Likes and comments indexes
CREATE INDEX IF NOT EXISTS idx_activity_likes_activity ON activity_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_likes_user ON activity_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_activity ON activity_comments(activity_id, created_at DESC);

-- Friend requests indexes
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id, status);

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE feed_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Feed activities policies
CREATE POLICY "Users can view public activities and friend activities" ON feed_activities FOR SELECT USING (
  is_public = true OR 
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM friendships 
    WHERE friendships.user_id = auth.uid() 
    AND friendships.friend_id = feed_activities.user_id 
    AND friendships.status = 'accepted'
  )
);

CREATE POLICY "Users can create their own activities" ON feed_activities FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Users can update their own activities" ON feed_activities FOR UPDATE USING (
  user_id = auth.uid()
);

-- Activity likes policies
CREATE POLICY "Users can view likes on visible activities" ON activity_likes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM feed_activities 
    WHERE feed_activities.id = activity_likes.activity_id
    AND (
      feed_activities.is_public = true OR 
      feed_activities.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM friendships 
        WHERE friendships.user_id = auth.uid() 
        AND friendships.friend_id = feed_activities.user_id 
        AND friendships.status = 'accepted'
      )
    )
  )
);

CREATE POLICY "Users can like/unlike activities" ON activity_likes FOR ALL USING (
  user_id = auth.uid()
);

-- Activity comments policies
CREATE POLICY "Users can view comments on visible activities" ON activity_comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM feed_activities 
    WHERE feed_activities.id = activity_comments.activity_id
    AND (
      feed_activities.is_public = true OR 
      feed_activities.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM friendships 
        WHERE friendships.user_id = auth.uid() 
        AND friendships.friend_id = feed_activities.user_id 
        AND friendships.status = 'accepted'
      )
    )
  )
);

CREATE POLICY "Users can comment on visible activities" ON activity_comments FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM feed_activities 
    WHERE feed_activities.id = activity_comments.activity_id
    AND (
      feed_activities.is_public = true OR 
      feed_activities.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM friendships 
        WHERE friendships.user_id = auth.uid() 
        AND friendships.friend_id = feed_activities.user_id 
        AND friendships.status = 'accepted'
      )
    )
  )
);

CREATE POLICY "Users can update their own comments" ON activity_comments FOR UPDATE USING (
  user_id = auth.uid()
);

-- Friend requests policies
CREATE POLICY "Users can view their friend requests" ON friend_requests FOR SELECT USING (
  from_user_id = auth.uid() OR to_user_id = auth.uid()
);

CREATE POLICY "Users can send friend requests" ON friend_requests FOR INSERT WITH CHECK (
  from_user_id = auth.uid()
);

CREATE POLICY "Users can update requests they're involved in" ON friend_requests FOR UPDATE USING (
  from_user_id = auth.uid() OR to_user_id = auth.uid()
);

-- ============================================================================
-- 5. TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update activity counts
CREATE OR REPLACE FUNCTION update_activity_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'activity_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE feed_activities 
      SET likes_count = likes_count + 1, updated_at = NOW()
      WHERE id = NEW.activity_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE feed_activities 
      SET likes_count = GREATEST(likes_count - 1, 0), updated_at = NOW()
      WHERE id = OLD.activity_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'activity_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE feed_activities 
      SET comments_count = comments_count + 1, updated_at = NOW()
      WHERE id = NEW.activity_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE feed_activities 
      SET comments_count = GREATEST(comments_count - 1, 0), updated_at = NOW()
      WHERE id = OLD.activity_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_activity_likes_count 
  AFTER INSERT OR DELETE ON activity_likes 
  FOR EACH ROW EXECUTE FUNCTION update_activity_counts();

CREATE TRIGGER update_activity_comments_count 
  AFTER INSERT OR DELETE ON activity_comments 
  FOR EACH ROW EXECUTE FUNCTION update_activity_counts();

-- Updated at triggers
CREATE TRIGGER update_feed_activities_updated_at 
  BEFORE UPDATE ON feed_activities 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_comments_updated_at 
  BEFORE UPDATE ON activity_comments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friend_requests_updated_at 
  BEFORE UPDATE ON friend_requests 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for social features
ALTER publication supabase_realtime ADD TABLE feed_activities;
ALTER publication supabase_realtime ADD TABLE activity_likes;
ALTER publication supabase_realtime ADD TABLE activity_comments;
ALTER publication supabase_realtime ADD TABLE friend_requests;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

COMMENT ON TABLE feed_activities IS 'Social activity feed showing friend activities, game completions, etc.';
COMMENT ON TABLE activity_likes IS 'Like system for feed activities';
COMMENT ON TABLE activity_comments IS 'Comment system for feed activities';
COMMENT ON TABLE friend_requests IS 'Enhanced friend request system with notifications';
COMMENT ON COLUMN feed_activities.activity_data IS 'JSON field containing sport, location, game details, achievements, etc.';
