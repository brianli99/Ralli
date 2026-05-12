-- ============================================================================
-- RALLI MVP DATABASE SETUP - GOOGLE PLACES API INTEGRATION
-- ============================================================================
-- This script sets up the complete database for MVP testing
-- Focus: Location-based discovery using Google Places API
-- Core Features: Check-ins, facility capacity, sessions, and social features
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 1: DROP EXISTING TABLES (CLEAN SLATE)
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
DROP TABLE IF EXISTS public.session_participants CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.check_ins CASCADE;
DROP TABLE IF EXISTS public.facility_capacity CASCADE;
-- Note: No courts table needed - we use Google Places API directly
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================================
-- STEP 2: CORE MVP TABLES - GOOGLE PLACES API INTEGRATION
-- ============================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  preferred_sports TEXT[] DEFAULT '{}',
  sport_preference_order TEXT[] DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT false,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_checkin_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check-ins table (CORE MVP FEATURE) - Uses Google Place IDs
CREATE TABLE public.check_ins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  google_place_id TEXT NOT NULL, -- Google Place ID from Google Places API
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  sport TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 60, -- How long they plan to stay
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Facility Capacity table (REAL-TIME COUNTS) - Uses Google Place IDs
CREATE TABLE public.facility_capacity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  google_place_id TEXT NOT NULL, -- Google Place ID from Google Places API
  sport TEXT NOT NULL,
  current_players INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 20,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(google_place_id, sport)
);

-- Sessions table - Uses Google Place IDs
CREATE TABLE public.sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  google_place_id TEXT NOT NULL, -- Google Place ID from Google Places API
  sport TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 10,
  current_players INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session participants table
CREATE TABLE public.session_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in' CHECK (status IN ('in', 'out', 'maybe')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- ============================================================================
-- STEP 3: SOCIAL FEATURES TABLES (FOR SQUAD TAB)
-- ============================================================================

-- Squads Table
CREATE TABLE public.squads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sport_code TEXT NOT NULL CHECK (sport_code IN ('basketball', 'tennis', 'pickleball', 'volleyball', 'running', 'soccer')),
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    theme_color TEXT DEFAULT '#1a73e8',
    is_private BOOLEAN DEFAULT false,
    max_members INTEGER DEFAULT NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    custom_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Squad Members Table
CREATE TABLE public.squad_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    squad_id UUID REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(squad_id, user_id)
);

-- Feed Activities Table
CREATE TABLE public.feed_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('game_completed', 'squad_joined', 'match_won', 'achievement_unlocked', 'check_in')),
    activity_data JSONB NOT NULL DEFAULT '{}',
    related_match_id UUID,
    related_squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL,
    related_facility_id TEXT,
    is_public BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Likes Table
CREATE TABLE public.activity_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_id UUID REFERENCES public.feed_activities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id, user_id)
);

-- Activity Comments Table  
CREATE TABLE public.activity_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_id UUID REFERENCES public.feed_activities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: INDEXES FOR PERFORMANCE - GOOGLE PLACES API INTEGRATION
-- ============================================================================

-- Core MVP indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_check_ins_user_id ON public.check_ins(user_id);
CREATE INDEX idx_check_ins_google_place_id ON public.check_ins(google_place_id);
CREATE INDEX idx_check_ins_created_at ON public.check_ins(created_at DESC);
CREATE INDEX idx_facility_capacity_google_place_id ON public.facility_capacity(google_place_id);
CREATE INDEX idx_facility_capacity_sport ON public.facility_capacity(sport);
CREATE INDEX idx_sessions_creator_id ON public.sessions(creator_id);
CREATE INDEX idx_sessions_google_place_id ON public.sessions(google_place_id);
CREATE INDEX idx_sessions_scheduled_for ON public.sessions(scheduled_for);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON public.session_participants(user_id);

-- Social features indexes
CREATE INDEX idx_feed_activities_user_id ON public.feed_activities(user_id);
CREATE INDEX idx_feed_activities_created_at ON public.feed_activities(created_at DESC);
CREATE INDEX idx_feed_activities_is_public ON public.feed_activities(is_public);
CREATE INDEX idx_activity_likes_activity_id ON public.activity_likes(activity_id);
CREATE INDEX idx_activity_comments_activity_id ON public.activity_comments(activity_id);
CREATE INDEX idx_squads_owner_id ON public.squads(owner_id);
CREATE INDEX idx_squads_sport_code ON public.squads(sport_code);
CREATE INDEX idx_squad_members_squad_id ON public.squad_members(squad_id);
CREATE INDEX idx_squad_members_user_id ON public.squad_members(user_id);

-- ============================================================================
-- STEP 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- Note: No courts table - we use Google Places API directly
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Note: No courts table policies needed - we use Google Places API directly

-- Check-ins policies (CORE MVP) - Google Places API integration
CREATE POLICY "Users can view all check-ins" ON public.check_ins FOR SELECT USING (true);
CREATE POLICY "Users can create their own check-ins" ON public.check_ins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own check-ins" ON public.check_ins FOR DELETE USING (auth.uid() = user_id);

-- Facility capacity policies (public read, authenticated write) - Google Places API integration
CREATE POLICY "Facility capacity is viewable by everyone" ON public.facility_capacity FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update capacity" ON public.facility_capacity FOR ALL USING (auth.uid() IS NOT NULL);

-- Sessions policies
CREATE POLICY "Users can view all sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Users can create sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Session creators can update their sessions" ON public.sessions FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Session creators can delete their sessions" ON public.sessions FOR DELETE USING (auth.uid() = creator_id);

-- Session participants policies
CREATE POLICY "Users can view all session participants" ON public.session_participants FOR SELECT USING (true);
CREATE POLICY "Users can join sessions" ON public.session_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON public.session_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave sessions" ON public.session_participants FOR DELETE USING (auth.uid() = user_id);

-- Social features policies
CREATE POLICY "feed_activities_select" ON public.feed_activities FOR SELECT USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "feed_activities_insert" ON public.feed_activities FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "feed_activities_update" ON public.feed_activities FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "feed_activities_delete" ON public.feed_activities FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "activity_likes_select" ON public.activity_likes FOR SELECT USING (true);
CREATE POLICY "activity_likes_insert" ON public.activity_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "activity_likes_delete" ON public.activity_likes FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "activity_comments_select" ON public.activity_comments FOR SELECT USING (true);
CREATE POLICY "activity_comments_insert" ON public.activity_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "activity_comments_update" ON public.activity_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "activity_comments_delete" ON public.activity_comments FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "squads_select" ON public.squads FOR SELECT USING (true);
CREATE POLICY "squads_insert" ON public.squads FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "squads_update" ON public.squads FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "squads_delete" ON public.squads FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "squad_members_select" ON public.squad_members FOR SELECT USING (true);
CREATE POLICY "squad_members_insert" ON public.squad_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "squad_members_update" ON public.squad_members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "squad_members_delete" ON public.squad_members FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- STEP 6: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: No courts table trigger needed - we use Google Places API directly

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_squads_updated_at BEFORE UPDATE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Triggers for activity counts
CREATE TRIGGER activity_likes_count_trigger
    AFTER INSERT OR DELETE ON public.activity_likes
    FOR EACH ROW EXECUTE FUNCTION update_activity_likes_count();

CREATE TRIGGER activity_comments_count_trigger
    AFTER INSERT OR DELETE ON public.activity_comments
    FOR EACH ROW EXECUTE FUNCTION update_activity_comments_count();

-- ============================================================================
-- STEP 7: SAMPLE DATA FOR MVP TESTING - GOOGLE PLACES API INTEGRATION
-- ============================================================================

-- Note: No sample courts needed - facilities are discovered dynamically via Google Places API
-- The app will automatically find real sports facilities near the user's location

-- Initialize some sample facility capacity data for popular Google Place IDs
-- These will be populated as users check in to real facilities
INSERT INTO public.facility_capacity (google_place_id, sport, current_players, max_capacity) VALUES
-- Sample San Francisco locations (these are example Google Place IDs)
('ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'basketball', 0, 10),
('ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'tennis', 0, 4),
('ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'pickleball', 0, 8),
('ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'volleyball', 0, 12),
('ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'soccer', 0, 22),
('ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'running', 0, 50);

-- Note: In production, capacity data will be created dynamically when users check in
-- to facilities discovered via Google Places API

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT 'MVP Database setup completed successfully! 🎉' as message;
SELECT 'Core features: Location-based discovery, check-ins, facility capacity, sessions, social features' as features;
SELECT 'Integration: Google Places API for real-time facility discovery worldwide' as integration;
SELECT 'Ready for MVP testing with global location support!' as status;
