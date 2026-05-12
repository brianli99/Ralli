-- ============================================================================
-- RALLI MVP TEST DATA - GOOGLE PLACES API INTEGRATION
-- ============================================================================
-- This script creates realistic test data for MVP testing
-- Run this AFTER mvp-database-setup.sql
-- Note: Uses Google Place IDs instead of internal court IDs
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TEST USERS (will work after you sign up in the app)
-- ============================================================================

-- Note: These users will be created when you sign up through the app
-- The handle_new_user() trigger will automatically create profiles

-- ============================================================================
-- STEP 2: CREATE REALISTIC CHECK-INS (CORE MVP FEATURE) - GOOGLE PLACES API
-- ============================================================================

-- Insert sample check-ins using Google Place IDs (these will work when users exist)
-- Note: Replace '00000000-0000-0000-0000-000000000000' with actual user IDs after signup
-- Note: These are example Google Place IDs - in production, they come from Google Places API

DO $$
BEGIN
    -- Recent check-ins (last 24 hours) - HIGH ACTIVITY
    -- Using example Google Place IDs for San Francisco locations
    INSERT INTO public.check_ins (user_id, google_place_id, latitude, longitude, sport, duration_minutes, created_at) VALUES
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.7596, -122.4269, 'basketball', 90, NOW() - INTERVAL '2 hours'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.7596, -122.4269, 'basketball', 120, NOW() - INTERVAL '4 hours'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.7694, -122.4862, 'tennis', 60, NOW() - INTERVAL '1 hour'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.8021, -122.4662, 'volleyball', 90, NOW() - INTERVAL '3 hours'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.7955, -122.3937, 'pickleball', 75, NOW() - INTERVAL '30 minutes'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.8040, -122.4430, 'running', 45, NOW() - INTERVAL '15 minutes'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.7211, -122.4584, 'basketball', 105, NOW() - INTERVAL '6 hours'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 37.7394, -122.4813, 'tennis', 90, NOW() - INTERVAL '5 hours');

    -- Update facility capacity based on recent check-ins (using Google Place IDs)
    UPDATE public.facility_capacity SET current_players = 8 WHERE google_place_id = 'ChIJd8BlQ2BZwokRAFQEcDlJRAI' AND sport = 'basketball';
    UPDATE public.facility_capacity SET current_players = 2 WHERE google_place_id = 'ChIJd8BlQ2BZwokRAFQEcDlJRAI' AND sport = 'tennis';
    UPDATE public.facility_capacity SET current_players = 6 WHERE google_place_id = 'ChIJd8BlQ2BZwokRAFQEcDlJRAI' AND sport = 'volleyball';
    UPDATE public.facility_capacity SET current_players = 4 WHERE google_place_id = 'ChIJd8BlQ2BZwokRAFQEcDlJRAI' AND sport = 'pickleball';
    UPDATE public.facility_capacity SET current_players = 12 WHERE google_place_id = 'ChIJd8BlQ2BZwokRAFQEcDlJRAI' AND sport = 'running';

END $$;

-- ============================================================================
-- STEP 3: CREATE UPCOMING SESSIONS - GOOGLE PLACES API INTEGRATION
-- ============================================================================

DO $$
DECLARE
    session_id_1 UUID;
    session_id_2 UUID;
    session_id_3 UUID;
    session_id_4 UUID;
    session_id_5 UUID;
    session_id_6 UUID;
BEGIN
    -- Create upcoming sessions using Google Place IDs
    -- Note: These are example Google Place IDs - in production, they come from Google Places API
    INSERT INTO public.sessions (creator_id, google_place_id, sport, title, description, scheduled_for, max_players, current_players, status) VALUES
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'basketball', 'Evening Basketball Run', 'Join us for a fun evening of basketball! All skill levels welcome.', NOW() + INTERVAL '2 hours', 10, 1, 'upcoming'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'tennis', 'Tennis Doubles', 'Looking for doubles partners. Intermediate level preferred.', NOW() + INTERVAL '4 hours', 4, 1, 'upcoming'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'volleyball', 'Beach Volleyball', 'Beach volleyball at Crissy Field. Bring sunscreen!', NOW() + INTERVAL '6 hours', 12, 1, 'upcoming'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'pickleball', 'Pickleball Tournament', 'Friendly tournament. Paddles provided.', NOW() + INTERVAL '1 day', 8, 1, 'upcoming'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'running', 'Morning Run Group', '5K run along the marina. All paces welcome!', NOW() + INTERVAL '1 day 6 hours', 20, 1, 'upcoming'),
    ('00000000-0000-0000-0000-000000000000', 'ChIJd8BlQ2BZwokRAFQEcDlJRAI', 'basketball', 'Weekend Basketball', 'Weekend pickup basketball. Bring your A-game!', NOW() + INTERVAL '2 days', 10, 1, 'upcoming')
    RETURNING id INTO session_id_1, session_id_2, session_id_3, session_id_4, session_id_5, session_id_6;

    -- Add some participants to sessions (these will work when users exist)
    INSERT INTO public.session_participants (session_id, user_id, status, joined_at) VALUES
    (session_id_1, '00000000-0000-0000-0000-000000000000', 'in', NOW()),
    (session_id_2, '00000000-0000-0000-0000-000000000000', 'in', NOW()),
    (session_id_3, '00000000-0000-0000-0000-000000000000', 'in', NOW()),
    (session_id_4, '00000000-0000-0000-0000-000000000000', 'in', NOW()),
    (session_id_5, '00000000-0000-0000-0000-000000000000', 'in', NOW()),
    (session_id_6, '00000000-0000-0000-0000-000000000000', 'in', NOW());

END $$;

-- ============================================================================
-- STEP 4: CREATE SAMPLE SQUADS AND SOCIAL ACTIVITIES
-- ============================================================================

DO $$
DECLARE
    squad_id_1 UUID;
    squad_id_2 UUID;
    squad_id_3 UUID;
    squad_id_4 UUID;
    squad_id_5 UUID;
BEGIN
    -- Create sample squads
    INSERT INTO public.squads (name, sport_code, description, owner_id) VALUES
    ('Warriors Weekend', 'basketball', 'Weekend basketball warriors! Join us for competitive games.', '00000000-0000-0000-0000-000000000000'),
    ('Tennis Pros', 'tennis', 'Serious tennis players looking for quality matches.', '00000000-0000-0000-0000-000000000000'),
    ('Beach Volleyball Crew', 'volleyball', 'Sand volleyball enthusiasts. All skill levels welcome!', '00000000-0000-0000-0000-000000000000'),
    ('Pickleball Masters', 'pickleball', 'Master the art of pickleball with us!', '00000000-0000-0000-0000-000000000000'),
    ('Marina Runners', 'running', 'Running group that meets at Marina Green. All paces welcome!', '00000000-0000-0000-0000-000000000000')
    RETURNING id INTO squad_id_1, squad_id_2, squad_id_3, squad_id_4, squad_id_5;

    -- Add squad members (these will work when users exist)
    INSERT INTO public.squad_members (squad_id, user_id, role, joined_at) VALUES
    (squad_id_1, '00000000-0000-0000-0000-000000000000', 'owner', NOW()),
    (squad_id_2, '00000000-0000-0000-0000-000000000000', 'owner', NOW()),
    (squad_id_3, '00000000-0000-0000-0000-000000000000', 'owner', NOW()),
    (squad_id_4, '00000000-0000-0000-0000-000000000000', 'owner', NOW()),
    (squad_id_5, '00000000-0000-0000-0000-000000000000', 'owner', NOW());

    -- Create sample feed activities
    INSERT INTO public.feed_activities (user_id, activity_type, activity_data, related_facility_id, likes_count, comments_count, created_at) VALUES
    ('00000000-0000-0000-0000-000000000000', 'check_in', '{"location": "Mission Dolores Park", "sport": "basketball", "duration": 90}', 'Mission Dolores Park Basketball Courts', 5, 2, NOW() - INTERVAL '2 hours'),
    ('00000000-0000-0000-0000-000000000000', 'squad_joined', '{"squad_name": "Warriors Weekend", "sport": "basketball"}', NULL, 8, 1, NOW() - INTERVAL '4 hours'),
    ('00000000-0000-0000-0000-000000000000', 'game_completed', '{"location": "Golden Gate Park", "sport": "tennis", "result": "Victory!", "score": "6-4, 6-2"}', 'Golden Gate Park Tennis Courts', 12, 3, NOW() - INTERVAL '6 hours'),
    ('00000000-0000-0000-0000-000000000000', 'check_in', '{"location": "Crissy Field", "sport": "volleyball", "duration": 90}', 'Crissy Field Sports Fields', 7, 1, NOW() - INTERVAL '8 hours'),
    ('00000000-0000-0000-0000-000000000000', 'achievement_unlocked', '{"achievement": "Court Warrior", "description": "Played 10 sessions this month", "rarity": "rare"}', NULL, 15, 5, NOW() - INTERVAL '1 day');

END $$;

-- ============================================================================
-- STEP 5: UPDATE USER STATS (for Profile screen)
-- ============================================================================

-- Update user stats for realistic MVP testing
UPDATE public.users SET 
    level = 12,
    xp = 2450,
    streak_days = 7,
    last_checkin_date = CURRENT_DATE,
    preferred_sports = ARRAY['basketball', 'tennis', 'volleyball'],
    sport_preference_order = ARRAY['basketball', 'tennis', 'volleyball', 'pickleball', 'running', 'soccer'],
    onboarding_completed = true
WHERE id = '00000000-0000-0000-0000-000000000000';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT 'MVP Test Data setup completed! 🎉' as message;
SELECT 'Created: Check-ins, sessions, squads, feed activities, user stats' as created;
SELECT 'Integration: Uses Google Place IDs for location-based discovery' as integration;
SELECT 'Note: Replace user IDs with actual user IDs after signup' as note;
SELECT 'Ready for comprehensive MVP testing with global location support!' as status;
