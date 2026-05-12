-- ============================================================================
-- RALLI SQUAD SYSTEM - SIMPLIFIED DATABASE SETUP
-- ============================================================================
-- Copy and paste this entire script into your Supabase SQL Editor
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Feed Activities Table
CREATE TABLE IF NOT EXISTS public.feed_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('game_completed', 'squad_joined', 'match_won', 'achievement_unlocked', 'check_in')),
    activity_data JSONB NOT NULL DEFAULT '{}',
    related_match_id UUID,
    related_squad_id UUID,
    related_facility_id TEXT,
    is_public BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Likes Table
CREATE TABLE IF NOT EXISTS public.activity_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_id UUID REFERENCES public.feed_activities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id, user_id)
);

-- Activity Comments Table  
CREATE TABLE IF NOT EXISTS public.activity_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_id UUID REFERENCES public.feed_activities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Squads Table
CREATE TABLE IF NOT EXISTS public.squads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sport_code TEXT NOT NULL CHECK (sport_code IN ('basketball', 'tennis', 'pickleball', 'volleyball', 'running', 'soccer')),
    avatar_url TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    custom_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Squad Members Table (SIMPLIFIED - NO CIRCULAR REFERENCES)
CREATE TABLE IF NOT EXISTS public.squad_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    squad_id UUID REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(squad_id, user_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feed_activities_user_id ON public.feed_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_activities_created_at ON public.feed_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_likes_activity_id ON public.activity_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_activity_id ON public.activity_comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_squads_owner_id ON public.squads(owner_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id ON public.squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user_id ON public.squad_members(user_id);

-- ============================================================================
-- SIMPLE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.feed_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- Feed Activities Policies
CREATE POLICY "Users can view public activities" ON public.feed_activities
    FOR SELECT USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can create their own activities" ON public.feed_activities
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own activities" ON public.feed_activities
    FOR UPDATE USING (user_id = auth.uid());

-- Activity Likes Policies
CREATE POLICY "Users can view all likes" ON public.activity_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" ON public.activity_likes
    FOR ALL USING (user_id = auth.uid());

-- Activity Comments Policies
CREATE POLICY "Users can view all comments" ON public.activity_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own comments" ON public.activity_comments
    FOR ALL USING (user_id = auth.uid());

-- Squads Policies
CREATE POLICY "Users can view all squads" ON public.squads
    FOR SELECT USING (true);

CREATE POLICY "Users can create squads" ON public.squads
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Squad owners can update their squads" ON public.squads
    FOR UPDATE USING (owner_id = auth.uid());

-- Squad Members Policies (SIMPLIFIED - NO RECURSION)
CREATE POLICY "Users can view squad members" ON public.squad_members
    FOR SELECT USING (true);

CREATE POLICY "Users can join squads" ON public.squad_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their own membership" ON public.squad_members
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can leave squads" ON public.squad_members
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- SAMPLE DATA (OPTIONAL - COMMENT OUT IF NOT NEEDED)
-- ============================================================================

-- Insert a sample squad (will only work after you're logged in)
-- INSERT INTO public.squads (name, sport_code, owner_id) 
-- VALUES ('Warriors Weekend', 'basketball', auth.uid());

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- If you see this message, the setup was successful!
SELECT 'Squad database setup completed successfully! 🎉' as message;
