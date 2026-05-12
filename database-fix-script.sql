-- ============================================================================
-- RALLI SQUAD SYSTEM - DATABASE FIX SCRIPT
-- ============================================================================
-- This script fixes the foreign key and RLS policy issues
-- Run this in Supabase SQL Editor to fix the errors
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES (to avoid "already exists" errors)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view public activities" ON public.feed_activities;
DROP POLICY IF EXISTS "Users can create their own activities" ON public.feed_activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.feed_activities;
DROP POLICY IF EXISTS "Users can view all likes" ON public.activity_likes;
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.activity_likes;
DROP POLICY IF EXISTS "Users can view all comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can manage their own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can view all squads" ON public.squads;
DROP POLICY IF EXISTS "Users can create squads" ON public.squads;
DROP POLICY IF EXISTS "Squad owners can update their squads" ON public.squads;
DROP POLICY IF EXISTS "Users can view squad members" ON public.squad_members;
DROP POLICY IF EXISTS "Users can join squads" ON public.squad_members;
DROP POLICY IF EXISTS "Users can manage their own membership" ON public.squad_members;
DROP POLICY IF EXISTS "Users can leave squads" ON public.squad_members;

-- ============================================================================
-- STEP 2: DROP AND RECREATE TABLES (to fix foreign key relationships)
-- ============================================================================

-- Drop tables in correct order (reverse dependency order)
DROP TABLE IF EXISTS public.direct_messages CASCADE;
DROP TABLE IF EXISTS public.direct_threads CASCADE;
DROP TABLE IF EXISTS public.squad_messages CASCADE;
DROP TABLE IF EXISTS public.user_qr_codes CASCADE;
DROP TABLE IF EXISTS public.friendships CASCADE;
DROP TABLE IF EXISTS public.activity_comments CASCADE;
DROP TABLE IF EXISTS public.activity_likes CASCADE;
DROP TABLE IF EXISTS public.feed_activities CASCADE;
DROP TABLE IF EXISTS public.squad_members CASCADE;
DROP TABLE IF EXISTS public.squads CASCADE;

-- ============================================================================
-- STEP 3: RECREATE TABLES WITH PROPER FOREIGN KEYS
-- ============================================================================

-- Squads Table (with all columns that the API expects)
CREATE TABLE public.squads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sport_code TEXT NOT NULL CHECK (sport_code IN ('basketball', 'tennis', 'pickleball', 'volleyball', 'running', 'soccer')),
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    theme_color TEXT,
    is_private BOOLEAN DEFAULT false,
    max_members INTEGER DEFAULT NULL,
    owner_id UUID NOT NULL,
    custom_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraint to auth.users
    CONSTRAINT fk_squads_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Squad Members Table (SIMPLIFIED - NO CIRCULAR REFERENCES)
CREATE TABLE public.squad_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    squad_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_squad_members_squad FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE,
    CONSTRAINT fk_squad_members_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE(squad_id, user_id)
);

-- Feed Activities Table
CREATE TABLE public.feed_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('game_completed', 'squad_joined', 'match_won', 'achievement_unlocked', 'check_in')),
    activity_data JSONB NOT NULL DEFAULT '{}',
    related_match_id UUID,
    related_squad_id UUID,
    related_facility_id TEXT,
    is_public BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_feed_activities_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_feed_activities_squad FOREIGN KEY (related_squad_id) REFERENCES public.squads(id) ON DELETE SET NULL
);

-- Activity Likes Table
CREATE TABLE public.activity_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_activity_likes_activity FOREIGN KEY (activity_id) REFERENCES public.feed_activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_likes_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE(activity_id, user_id)
);

-- Activity Comments Table  
CREATE TABLE public.activity_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_activity_comments_activity FOREIGN KEY (activity_id) REFERENCES public.feed_activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_comments_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Friendships Table
CREATE TABLE public.friendships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    friend_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_friendships_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_friendships_friend FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE(user_id, friend_id)
);

-- User QR Codes Table
CREATE TABLE public.user_qr_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraint
    CONSTRAINT fk_user_qr_codes_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Squad Messages Table
CREATE TABLE public.squad_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    squad_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_squad_messages_squad FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE,
    CONSTRAINT fk_squad_messages_sender FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Direct Message Threads Table
CREATE TABLE public.direct_threads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_a UUID NOT NULL,
    user_b UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_direct_threads_user_a FOREIGN KEY (user_a) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_direct_threads_user_b FOREIGN KEY (user_b) REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Unique constraint (prevent duplicate threads)
    UNIQUE(user_a, user_b)
);

-- Direct Messages Table
CREATE TABLE public.direct_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    thread_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add foreign key constraints
    CONSTRAINT fk_direct_messages_thread FOREIGN KEY (thread_id) REFERENCES public.direct_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_direct_messages_sender FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core table indexes
CREATE INDEX idx_feed_activities_user_id ON public.feed_activities(user_id);
CREATE INDEX idx_feed_activities_created_at ON public.feed_activities(created_at DESC);
CREATE INDEX idx_feed_activities_is_public ON public.feed_activities(is_public);
CREATE INDEX idx_activity_likes_activity_id ON public.activity_likes(activity_id);
CREATE INDEX idx_activity_likes_user_id ON public.activity_likes(user_id);
CREATE INDEX idx_activity_comments_activity_id ON public.activity_comments(activity_id);
CREATE INDEX idx_squads_owner_id ON public.squads(owner_id);
CREATE INDEX idx_squads_sport_code ON public.squads(sport_code);
CREATE INDEX idx_squad_members_squad_id ON public.squad_members(squad_id);
CREATE INDEX idx_squad_members_user_id ON public.squad_members(user_id);

-- Additional table indexes
CREATE INDEX idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);
CREATE INDEX idx_user_qr_codes_user_id ON public.user_qr_codes(user_id);
CREATE INDEX idx_user_qr_codes_code ON public.user_qr_codes(code);
CREATE INDEX idx_user_qr_codes_expires_at ON public.user_qr_codes(expires_at);
CREATE INDEX idx_squad_messages_squad_id ON public.squad_messages(squad_id);
CREATE INDEX idx_squad_messages_sender_id ON public.squad_messages(sender_id);
CREATE INDEX idx_squad_messages_created_at ON public.squad_messages(created_at DESC);
CREATE INDEX idx_direct_threads_user_a ON public.direct_threads(user_a);
CREATE INDEX idx_direct_threads_user_b ON public.direct_threads(user_b);
CREATE INDEX idx_direct_messages_thread_id ON public.direct_messages(thread_id);
CREATE INDEX idx_direct_messages_sender_id ON public.direct_messages(sender_id);
CREATE INDEX idx_direct_messages_created_at ON public.direct_messages(created_at DESC);

-- ============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.feed_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: CREATE SIMPLE RLS POLICIES (NO RECURSION)
-- ============================================================================

-- Feed Activities Policies
CREATE POLICY "feed_activities_select" ON public.feed_activities
    FOR SELECT USING (
        is_public = true OR 
        user_id = auth.uid()
    );

CREATE POLICY "feed_activities_insert" ON public.feed_activities
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_activities_update" ON public.feed_activities
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "feed_activities_delete" ON public.feed_activities
    FOR DELETE USING (user_id = auth.uid());

-- Activity Likes Policies
CREATE POLICY "activity_likes_select" ON public.activity_likes
    FOR SELECT USING (true);

CREATE POLICY "activity_likes_insert" ON public.activity_likes
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "activity_likes_delete" ON public.activity_likes
    FOR DELETE USING (user_id = auth.uid());

-- Activity Comments Policies
CREATE POLICY "activity_comments_select" ON public.activity_comments
    FOR SELECT USING (true);

CREATE POLICY "activity_comments_insert" ON public.activity_comments
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "activity_comments_update" ON public.activity_comments
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "activity_comments_delete" ON public.activity_comments
    FOR DELETE USING (user_id = auth.uid());

-- Squads Policies
CREATE POLICY "squads_select" ON public.squads
    FOR SELECT USING (true);

CREATE POLICY "squads_insert" ON public.squads
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "squads_update" ON public.squads
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "squads_delete" ON public.squads
    FOR DELETE USING (owner_id = auth.uid());

-- Squad Members Policies (SIMPLE - NO RECURSION)
CREATE POLICY "squad_members_select" ON public.squad_members
    FOR SELECT USING (true);

CREATE POLICY "squad_members_insert" ON public.squad_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "squad_members_update" ON public.squad_members
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "squad_members_delete" ON public.squad_members
    FOR DELETE USING (user_id = auth.uid());

-- Friendships Policies
CREATE POLICY "friendships_select" ON public.friendships
    FOR SELECT USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "friendships_insert" ON public.friendships
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "friendships_update" ON public.friendships
    FOR UPDATE USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "friendships_delete" ON public.friendships
    FOR DELETE USING (user_id = auth.uid());

-- User QR Codes Policies
CREATE POLICY "user_qr_codes_select" ON public.user_qr_codes
    FOR SELECT USING (true);

CREATE POLICY "user_qr_codes_insert" ON public.user_qr_codes
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_qr_codes_update" ON public.user_qr_codes
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_qr_codes_delete" ON public.user_qr_codes
    FOR DELETE USING (user_id = auth.uid());

-- Squad Messages Policies
CREATE POLICY "squad_messages_select" ON public.squad_messages
    FOR SELECT USING (true);

CREATE POLICY "squad_messages_insert" ON public.squad_messages
    FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "squad_messages_update" ON public.squad_messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "squad_messages_delete" ON public.squad_messages
    FOR DELETE USING (sender_id = auth.uid());

-- Direct Threads Policies
CREATE POLICY "direct_threads_select" ON public.direct_threads
    FOR SELECT USING (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY "direct_threads_insert" ON public.direct_threads
    FOR INSERT WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY "direct_threads_update" ON public.direct_threads
    FOR UPDATE USING (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY "direct_threads_delete" ON public.direct_threads
    FOR DELETE USING (user_a = auth.uid() OR user_b = auth.uid());

-- Direct Messages Policies
CREATE POLICY "direct_messages_select" ON public.direct_messages
    FOR SELECT USING (true);

CREATE POLICY "direct_messages_insert" ON public.direct_messages
    FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "direct_messages_update" ON public.direct_messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "direct_messages_delete" ON public.direct_messages
    FOR DELETE USING (sender_id = auth.uid());

-- ============================================================================
-- STEP 7: CREATE FUNCTIONS TO UPDATE COUNTS
-- ============================================================================

-- Function to update activity likes count
CREATE OR REPLACE FUNCTION update_activity_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.feed_activities 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.activity_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.feed_activities 
        SET likes_count = likes_count - 1 
        WHERE id = OLD.activity_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update activity comments count
CREATE OR REPLACE FUNCTION update_activity_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.feed_activities 
        SET comments_count = comments_count + 1 
        WHERE id = NEW.activity_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.feed_activities 
        SET comments_count = comments_count - 1 
        WHERE id = OLD.activity_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 8: CREATE TRIGGERS
-- ============================================================================

-- Trigger for activity likes count
DROP TRIGGER IF EXISTS activity_likes_count_trigger ON public.activity_likes;
CREATE TRIGGER activity_likes_count_trigger
    AFTER INSERT OR DELETE ON public.activity_likes
    FOR EACH ROW EXECUTE FUNCTION update_activity_likes_count();

-- Trigger for activity comments count
DROP TRIGGER IF EXISTS activity_comments_count_trigger ON public.activity_comments;
CREATE TRIGGER activity_comments_count_trigger
    AFTER INSERT OR DELETE ON public.activity_comments
    FOR EACH ROW EXECUTE FUNCTION update_activity_comments_count();

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT 'Squad database fix completed successfully! 🎉' as message;
SELECT 'All foreign key relationships are now properly configured.' as status;
SELECT 'RLS policies have been simplified to avoid recursion.' as policies;
SELECT 'You can now test the Squad system without errors.' as next_step;
