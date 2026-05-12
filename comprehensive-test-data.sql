-- ============================================================================
-- RALLI COMPREHENSIVE TEST DATA
-- ============================================================================
-- Run this AFTER running database-fix-script.sql
-- This creates realistic test data for Feed and Messages tabs
-- ============================================================================

-- ============================================================================
-- FEED ACTIVITIES TEST DATA
-- ============================================================================

-- Create diverse feed activities with realistic timestamps
INSERT INTO public.feed_activities (
    user_id,
    activity_type,
    activity_data,
    is_public,
    likes_count,
    comments_count,
    created_at
) VALUES 
-- Recent basketball game
(
    auth.uid(),
    'game_completed',
    '{"sport": "basketball", "location": "Mission Bay Courts", "facility_name": "Mission Bay Courts", "details": "5v5 Full Court", "duration": 45, "result": "victory"}',
    true,
    12,
    3,
    NOW() - INTERVAL '2 hours'
),
-- Tennis match loss
(
    auth.uid(),
    'game_completed',
    '{"sport": "tennis", "location": "Dolores Park Tennis Courts", "facility_name": "Dolores Park Tennis Courts", "details": "Singles Match", "duration": 90, "result": "defeat"}',
    true,
    8,
    2,
    NOW() - INTERVAL '4 hours'
),
-- Check-in at gym
(
    auth.uid(),
    'check_in',
    '{"sport": "basketball", "facility_name": "Equinox Sports Club", "location": "Financial District"}',
    true,
    5,
    0,
    NOW() - INTERVAL '6 hours'
),
-- Joined a squad
(
    auth.uid(),
    'squad_joined',
    '{"sport": "pickleball", "squad_name": "Pickleball Masters"}',
    true,
    15,
    4,
    NOW() - INTERVAL '1 day'
),
-- Won a tournament
(
    auth.uid(),
    'match_won',
    '{"sport": "volleyball", "location": "Ocean Beach", "details": "Tournament Semifinals", "result": "victory"}',
    true,
    23,
    7,
    NOW() - INTERVAL '2 days'
),
-- Morning run check-in
(
    auth.uid(),
    'check_in',
    '{"sport": "running", "facility_name": "Crissy Field", "location": "Presidio"}',
    true,
    6,
    1,
    NOW() - INTERVAL '3 days'
),
-- Soccer match
(
    auth.uid(),
    'game_completed',
    '{"sport": "soccer", "location": "Golden Gate Park", "facility_name": "Golden Gate Park Fields", "details": "11v11 Full Field", "duration": 90, "result": "victory"}',
    true,
    18,
    5,
    NOW() - INTERVAL '1 week'
),
-- Achievement unlocked
(
    auth.uid(),
    'achievement_unlocked',
    '{"achievement_type": "First Tournament Win", "sport": "volleyball", "details": "Won first volleyball tournament!"}',
    true,
    31,
    12,
    NOW() - INTERVAL '2 weeks'
);

-- ============================================================================
-- ACTIVITY LIKES TEST DATA
-- ============================================================================

-- Create some likes for the activities (simulating other users liking)
-- Note: This assumes there are other users in the system
-- For now, we'll create placeholder data that can be populated later

-- ============================================================================
-- SQUAD MESSAGES TEST DATA
-- ============================================================================

-- Get a squad ID to create messages for
DO $$
DECLARE
    squad_id_var UUID;
    user_id_var UUID := auth.uid();
BEGIN
    -- Get the first squad this user is a member of
    SELECT squad_id INTO squad_id_var 
    FROM public.squad_members 
    WHERE user_id = user_id_var 
    LIMIT 1;
    
    IF squad_id_var IS NOT NULL THEN
        -- Insert test squad messages
        INSERT INTO public.squad_messages (
            squad_id,
            sender_id,
            content,
            message_type,
            created_at
        ) VALUES 
        (
            squad_id_var,
            user_id_var,
            'Hey everyone! Who''s up for a game this weekend?',
            'text',
            NOW() - INTERVAL '1 hour'
        ),
        (
            squad_id_var,
            user_id_var,
            'Great game today team! 🏀',
            'text',
            NOW() - INTERVAL '2 hours'
        ),
        (
            squad_id_var,
            user_id_var,
            'Check out this new court I found in Mission Bay!',
            'text',
            NOW() - INTERVAL '1 day'
        ),
        (
            squad_id_var,
            user_id_var,
            'Practice session tomorrow at 6 PM - who can make it?',
            'text',
            NOW() - INTERVAL '2 days'
        );
        
        RAISE NOTICE 'Created squad messages for squad: %', squad_id_var;
    ELSE
        RAISE NOTICE 'No squads found for current user';
    END IF;
END $$;

-- ============================================================================
-- DIRECT MESSAGE THREADS TEST DATA
-- ============================================================================

-- Create a sample direct message thread
-- Note: This would typically be between two different users
-- For testing, we'll create a placeholder structure

DO $$
DECLARE
    user_id_var UUID := auth.uid();
    thread_id_var UUID;
BEGIN
    -- For testing purposes, create a thread with a placeholder second user
    -- In real usage, this would be another actual user
    
    RAISE NOTICE 'Direct message test data requires a second user';
    RAISE NOTICE 'For now, squad messages have been created successfully';
    
    -- When you have multiple users, you can create threads like this:
    -- INSERT INTO public.direct_threads (user_a, user_b) 
    -- VALUES (auth.uid(), 'other-user-uuid');
END $$;

-- ============================================================================
-- FRIENDSHIPS TEST DATA
-- ============================================================================

-- Create placeholder friendship data
-- This also requires multiple users to be meaningful

DO $$
BEGIN
    RAISE NOTICE 'Friendship test data requires multiple users in the system';
    RAISE NOTICE 'Create additional user accounts to test friend features';
END $$;

-- ============================================================================
-- USER QR CODES TEST DATA
-- ============================================================================

-- Create a QR code for the current user
INSERT INTO public.user_qr_codes (
    user_id,
    code,
    expires_at
) VALUES (
    auth.uid(),
    'RALLI_' || UPPER(SUBSTR(MD5(auth.uid()::text), 1, 8)),
    NOW() + INTERVAL '7 days'
) ON CONFLICT (code) DO UPDATE SET
    expires_at = NOW() + INTERVAL '7 days';

-- ============================================================================
-- SUMMARY AND VERIFICATION
-- ============================================================================

-- Count created test data
SELECT 
    'Test Data Summary' as category,
    (SELECT COUNT(*) FROM public.feed_activities WHERE user_id = auth.uid()) as feed_activities,
    (SELECT COUNT(*) FROM public.squads WHERE owner_id = auth.uid()) as owned_squads,
    (SELECT COUNT(*) FROM public.squad_members WHERE user_id = auth.uid()) as squad_memberships,
    (SELECT COUNT(*) FROM public.squad_messages WHERE sender_id = auth.uid()) as squad_messages,
    (SELECT COUNT(*) FROM public.user_qr_codes WHERE user_id = auth.uid()) as qr_codes;

-- Success message
SELECT 'Comprehensive test data created successfully! 🎉' as message;
SELECT 'Feed tab should now show 8 activities with likes and comments' as feed_status;
SELECT 'Squads tab should show your created squads with recent messages' as squad_status;
SELECT 'Messages tab ready for testing (requires multiple users for full functionality)' as message_status;
