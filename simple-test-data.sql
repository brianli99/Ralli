-- ============================================================================
-- SIMPLE TEST DATA - WORKS WITHOUT AUTH CONTEXT
-- ============================================================================
-- Run this in Supabase SQL Editor to create test data
-- This script gets your user ID from the auth.users table
-- ============================================================================

-- First, let's see what users exist
SELECT 'Available users:' as info;
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- ============================================================================
-- CREATE TEST FEED ACTIVITIES
-- ============================================================================

-- Insert test activities using the first user in the system
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Get the first user ID from auth.users
    SELECT id INTO test_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Insert test feed activities
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
            test_user_id,
            'game_completed',
            '{"sport": "basketball", "location": "Mission Bay Courts", "facility_name": "Mission Bay Courts", "details": "5v5 Full Court", "duration": 45, "result": "victory"}',
            true,
            12,
            3,
            NOW() - INTERVAL '2 hours'
        ),
        -- Tennis match
        (
            test_user_id,
            'game_completed',
            '{"sport": "tennis", "location": "Dolores Park Tennis Courts", "facility_name": "Dolores Park Tennis Courts", "details": "Singles Match", "duration": 90, "result": "defeat"}',
            true,
            8,
            2,
            NOW() - INTERVAL '4 hours'
        ),
        -- Gym check-in
        (
            test_user_id,
            'check_in',
            '{"sport": "basketball", "facility_name": "Equinox Sports Club", "location": "Financial District"}',
            true,
            5,
            0,
            NOW() - INTERVAL '6 hours'
        ),
        -- Joined squad
        (
            test_user_id,
            'squad_joined',
            '{"sport": "pickleball", "squad_name": "Pickleball Masters"}',
            true,
            15,
            4,
            NOW() - INTERVAL '1 day'
        ),
        -- Tournament win
        (
            test_user_id,
            'match_won',
            '{"sport": "volleyball", "location": "Ocean Beach", "details": "Tournament Finals", "result": "victory"}',
            true,
            23,
            7,
            NOW() - INTERVAL '2 days'
        ),
        -- Running check-in
        (
            test_user_id,
            'check_in',
            '{"sport": "running", "facility_name": "Crissy Field", "location": "Presidio"}',
            true,
            6,
            1,
            NOW() - INTERVAL '3 days'
        ),
        -- Soccer match
        (
            test_user_id,
            'game_completed',
            '{"sport": "soccer", "location": "Golden Gate Park", "facility_name": "Golden Gate Park Fields", "details": "11v11 Full Field", "duration": 90, "result": "victory"}',
            true,
            18,
            5,
            NOW() - INTERVAL '1 week'
        ),
        -- Achievement
        (
            test_user_id,
            'achievement_unlocked',
            '{"achievement_type": "First Tournament Win", "sport": "volleyball", "details": "Won first volleyball tournament!"}',
            true,
            31,
            12,
            NOW() - INTERVAL '2 weeks'
        );
        
        RAISE NOTICE 'Created 8 test feed activities for user: %', test_user_id;
        
        -- Also create some squad messages if squads exist
        IF EXISTS (SELECT 1 FROM public.squads WHERE owner_id = test_user_id) THEN
            DECLARE
                test_squad_id UUID;
            BEGIN
                SELECT id INTO test_squad_id FROM public.squads WHERE owner_id = test_user_id LIMIT 1;
                
                INSERT INTO public.squad_messages (
                    squad_id,
                    sender_id,
                    content,
                    message_type,
                    created_at
                ) VALUES 
                (
                    test_squad_id,
                    test_user_id,
                    'Hey everyone! Who''s up for a game this weekend?',
                    'text',
                    NOW() - INTERVAL '1 hour'
                ),
                (
                    test_squad_id,
                    test_user_id,
                    'Great game today team! 🏀',
                    'text',
                    NOW() - INTERVAL '2 hours'
                ),
                (
                    test_squad_id,
                    test_user_id,
                    'Check out this new court I found in Mission Bay!',
                    'text',
                    NOW() - INTERVAL '1 day'
                );
                
                RAISE NOTICE 'Created squad messages for squad: %', test_squad_id;
            END;
        END IF;
        
        -- Create a QR code for the user
        INSERT INTO public.user_qr_codes (
            user_id,
            code,
            expires_at
        ) VALUES (
            test_user_id,
            'RALLI_' || UPPER(SUBSTR(MD5(test_user_id::text), 1, 8)),
            NOW() + INTERVAL '7 days'
        ) ON CONFLICT (code) DO UPDATE SET
            expires_at = NOW() + INTERVAL '7 days';
        
        RAISE NOTICE 'Created QR code for user';
        
        -- Create some test squad messages if squads exist
        IF EXISTS (SELECT 1 FROM public.squads WHERE owner_id = test_user_id) THEN
            DECLARE
                test_squad_id UUID;
            BEGIN
                SELECT id INTO test_squad_id FROM public.squads WHERE owner_id = test_user_id LIMIT 1;
                
                IF test_squad_id IS NOT NULL THEN
                    INSERT INTO public.squad_messages (
                        squad_id,
                        sender_id,
                        content,
                        message_type,
                        created_at
                    ) VALUES 
                    (
                        test_squad_id,
                        test_user_id,
                        'Hey everyone! Who''s up for a game this weekend? 🏀',
                        'text',
                        NOW() - INTERVAL '1 hour'
                    ),
                    (
                        test_squad_id,
                        test_user_id,
                        'Great practice session today team!',
                        'text',
                        NOW() - INTERVAL '2 hours'
                    ),
                    (
                        test_squad_id,
                        test_user_id,
                        'Check out this new court I found in Mission Bay!',
                        'text',
                        NOW() - INTERVAL '1 day'
                    ),
                    (
                        test_squad_id,
                        test_user_id,
                        'Tournament this Friday - who can make it?',
                        'text',
                        NOW() - INTERVAL '2 days'
                    );
                    
                    RAISE NOTICE 'Created squad messages for squad: %', test_squad_id;
                END IF;
            END;
        END IF;
        
    ELSE
        RAISE NOTICE 'No users found in auth.users table';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show what was created
SELECT 
    'Test Data Summary' as category,
    (SELECT COUNT(*) FROM public.feed_activities) as total_feed_activities,
    (SELECT COUNT(*) FROM public.squads) as total_squads,
    (SELECT COUNT(*) FROM public.squad_members) as total_squad_members,
    (SELECT COUNT(*) FROM public.squad_messages) as total_squad_messages,
    (SELECT COUNT(*) FROM public.user_qr_codes) as total_qr_codes;

-- Show recent activities
SELECT 
    'Recent Activities:' as info,
    activity_type,
    activity_data->>'sport' as sport,
    activity_data->>'location' as location,
    likes_count,
    comments_count,
    created_at
FROM public.feed_activities 
ORDER BY created_at DESC 
LIMIT 5;

-- Success message
SELECT 'Test data created successfully! 🎉' as message;
SELECT 'Refresh your app to see the new feed activities' as instruction;
