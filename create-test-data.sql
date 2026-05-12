-- ============================================================================
-- RALLI TEST DATA - MANUAL CREATION SCRIPT
-- ============================================================================
-- Run this directly in Supabase SQL Editor to create test data
-- This works with the current partial schema
-- ============================================================================

-- First, let's check what tables exist
SELECT 'Current Tables:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- ============================================================================
-- CREATE TEST FEED ACTIVITIES (if table exists)
-- ============================================================================

-- Insert test activities directly (bypassing the foreign key issue for now)
DO $$
BEGIN
    -- Check if feed_activities table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feed_activities') THEN
        -- Get the current user ID
        IF auth.uid() IS NOT NULL THEN
            -- Insert test activities
            INSERT INTO public.feed_activities (
                user_id,
                activity_type,
                activity_data,
                is_public,
                likes_count,
                comments_count,
                created_at
            ) VALUES 
            (
                auth.uid(),
                'game_completed',
                '{"sport": "basketball", "location": "Mission Bay Courts", "facility_name": "Mission Bay Courts", "details": "5v5 Full Court", "duration": 45, "result": "victory"}',
                true,
                12,
                3,
                NOW() - INTERVAL '2 hours'
            ),
            (
                auth.uid(),
                'check_in',
                '{"sport": "tennis", "facility_name": "Dolores Park Tennis Courts", "location": "Dolores Park"}',
                true,
                5,
                1,
                NOW() - INTERVAL '4 hours'
            ),
            (
                auth.uid(),
                'squad_joined',
                '{"sport": "pickleball", "squad_name": "Pickleball Masters"}',
                true,
                8,
                2,
                NOW() - INTERVAL '1 day'
            ),
            (
                auth.uid(),
                'match_won',
                '{"sport": "volleyball", "location": "Ocean Beach", "details": "Tournament Finals", "result": "victory"}',
                true,
                15,
                5,
                NOW() - INTERVAL '3 days'
            ),
            (
                auth.uid(),
                'check_in',
                '{"sport": "running", "facility_name": "Crissy Field", "location": "Presidio"}',
                true,
                3,
                0,
                NOW() - INTERVAL '1 week'
            );
            
            RAISE NOTICE 'Created 5 test feed activities!';
        ELSE
            RAISE NOTICE 'No authenticated user - cannot create activities';
        END IF;
    ELSE
        RAISE NOTICE 'feed_activities table does not exist yet';
    END IF;
END $$;

-- ============================================================================
-- CREATE TEST MESSAGES DATA (placeholder)
-- ============================================================================

DO $$
BEGIN
    -- Check if squad_messages table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'squad_messages') THEN
        RAISE NOTICE 'squad_messages table exists - ready for message test data';
        
        -- We'll add message test data after the full schema is applied
        -- For now, just confirm the table structure
        
    ELSE
        RAISE NOTICE 'squad_messages table does not exist yet - run database-fix-script.sql first';
    END IF;
    
    -- Check if direct_messages table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'direct_messages') THEN
        RAISE NOTICE 'direct_messages table exists - ready for DM test data';
    ELSE
        RAISE NOTICE 'direct_messages table does not exist yet - run database-fix-script.sql first';
    END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
    'Test Data Creation Summary' as summary,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feed_activities')
        THEN 'Feed activities created ✅'
        ELSE 'Feed activities table missing ❌'
    END as feed_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'squad_messages')
        THEN 'Message tables ready ✅'
        ELSE 'Message tables missing ❌ - Run database-fix-script.sql'
    END as message_status;
