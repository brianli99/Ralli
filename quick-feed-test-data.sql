-- ============================================================================
-- QUICK FEED TEST DATA - WORKS WITH CURRENT SCHEMA
-- ============================================================================
-- Run this in Supabase SQL Editor to create test feed activities
-- This bypasses the foreign key relationship issues
-- ============================================================================

-- Insert test feed activities directly
INSERT INTO public.feed_activities (
    user_id,
    activity_type,
    activity_data,
    is_public,
    likes_count,
    comments_count,
    created_at
) VALUES 
-- Basketball game
(
    auth.uid(),
    'game_completed',
    '{"sport": "basketball", "location": "Mission Bay Courts", "facility_name": "Mission Bay Courts", "details": "5v5 Full Court", "duration": 45, "result": "victory"}',
    true,
    12,
    3,
    NOW() - INTERVAL '2 hours'
),
-- Tennis match
(
    auth.uid(),
    'game_completed',
    '{"sport": "tennis", "location": "Dolores Park Tennis Courts", "facility_name": "Dolores Park Tennis Courts", "details": "Singles Match", "duration": 90, "result": "defeat"}',
    true,
    8,
    2,
    NOW() - INTERVAL '4 hours'
),
-- Gym check-in
(
    auth.uid(),
    'check_in',
    '{"sport": "basketball", "facility_name": "Equinox Sports Club", "location": "Financial District"}',
    true,
    5,
    0,
    NOW() - INTERVAL '6 hours'
),
-- Joined squad
(
    auth.uid(),
    'squad_joined',
    '{"sport": "pickleball", "squad_name": "Pickleball Masters"}',
    true,
    15,
    4,
    NOW() - INTERVAL '1 day'
),
-- Tournament win
(
    auth.uid(),
    'match_won',
    '{"sport": "volleyball", "location": "Ocean Beach", "details": "Tournament Finals", "result": "victory"}',
    true,
    23,
    7,
    NOW() - INTERVAL '2 days'
),
-- Running check-in
(
    auth.uid(),
    'check_in',
    '{"sport": "running", "facility_name": "Crissy Field", "location": "Presidio"}',
    true,
    6,
    1,
    NOW() - INTERVAL '3 days'
);

-- Success message
SELECT 'Created 6 test feed activities! 🎉' as message;
SELECT 'Refresh the Feed tab in your app to see the activities' as instruction;
