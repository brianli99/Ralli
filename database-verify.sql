-- ============================================================================
-- RALLI SQUAD SYSTEM - DATABASE VERIFICATION SCRIPT
-- ============================================================================
-- Run this after the fix script to verify everything is working
-- ============================================================================

-- Check if all tables exist
SELECT 
    'Tables Check' as test_type,
    CASE 
        WHEN COUNT(*) = 5 THEN '✅ All 5 tables exist'
        ELSE '❌ Missing tables: ' || (5 - COUNT(*))::text
    END as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('squads', 'squad_members', 'feed_activities', 'activity_likes', 'activity_comments');

-- Check foreign key constraints
SELECT 
    'Foreign Keys Check' as test_type,
    CASE 
        WHEN COUNT(*) >= 7 THEN '✅ Foreign key constraints exist'
        ELSE '❌ Missing foreign key constraints'
    END as result
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND table_schema = 'public'
AND table_name IN ('squads', 'squad_members', 'feed_activities', 'activity_likes', 'activity_comments');

-- Check RLS is enabled
SELECT 
    'RLS Check' as test_type,
    CASE 
        WHEN COUNT(*) = 5 THEN '✅ RLS enabled on all tables'
        ELSE '❌ RLS not enabled on all tables'
    END as result
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('squads', 'squad_members', 'feed_activities', 'activity_likes', 'activity_comments')
AND rowsecurity = true;

-- Check policies exist
SELECT 
    'Policies Check' as test_type,
    CASE 
        WHEN COUNT(*) >= 16 THEN '✅ RLS policies exist'
        ELSE '❌ Missing RLS policies: ' || (16 - COUNT(*))::text
    END as result
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('squads', 'squad_members', 'feed_activities', 'activity_likes', 'activity_comments');

-- Check indexes exist
SELECT 
    'Indexes Check' as test_type,
    CASE 
        WHEN COUNT(*) >= 8 THEN '✅ Performance indexes exist'
        ELSE '❌ Missing indexes'
    END as result
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN ('squads', 'squad_members', 'feed_activities', 'activity_likes', 'activity_comments')
AND indexname LIKE 'idx_%';

-- Final status
SELECT 
    '🎯 Database Status' as summary,
    'Ready for testing!' as message;
