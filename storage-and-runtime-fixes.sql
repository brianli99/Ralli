-- ============================================================================
-- Storage + Runtime Fixes
-- Run this in your Supabase SQL editor to enable avatar uploads and any
-- still-missing tables encountered during testing.
-- Safe to run multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AVATARS STORAGE BUCKET + POLICIES
-- ----------------------------------------------------------------------------
-- Creates a public 'avatars' bucket and grants the right RLS policies so
-- authenticated users can upload/replace their own profile picture and the
-- public can read avatars.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read avatar files (public profile pictures)
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow authenticated users to upload to the avatars bucket
DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
CREATE POLICY "Authenticated upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

-- Allow users to update/replace their own files in the avatars bucket
DROP POLICY IF EXISTS "Users update own avatars" ON storage.objects;
CREATE POLICY "Users update own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

-- Allow users to delete their own avatar files
DROP POLICY IF EXISTS "Users delete own avatars" ON storage.objects;
CREATE POLICY "Users delete own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

-- ----------------------------------------------------------------------------
-- 2. USER_FAVORITES (re-applied here in case beta-features-schema.sql wasn't run)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_place_id TEXT NOT NULL,
  facility_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_place_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON user_favorites;
CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add favorites" ON user_favorites;
CREATE POLICY "Users can add favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove favorites" ON user_favorites;
CREATE POLICY "Users can remove favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_favorites;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 3. SQUAD_MEMBERS: missing position / jersey_number columns
-- The newer squad-schema-fix.sql adds these via CREATE TABLE IF NOT EXISTS,
-- which is a no-op if the table already exists. Add them explicitly here.
-- ----------------------------------------------------------------------------

ALTER TABLE squad_members ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE squad_members ADD COLUMN IF NOT EXISTS jersey_number INTEGER;
ALTER TABLE squad_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();
