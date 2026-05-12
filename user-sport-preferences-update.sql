-- User Sport Preferences Update
-- This migration adds enhanced sport preference functionality

-- Ensure the preferred_sports column exists and is properly structured
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferred_sports TEXT[] DEFAULT '{}';

-- Add a sport preference order field (ordered array where index 0 is most preferred)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS sport_preference_order TEXT[] DEFAULT '{}';

-- Add onboarding completion tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add some helpful comments
COMMENT ON COLUMN users.preferred_sports IS 'Array of sports the user is interested in';
COMMENT ON COLUMN users.sport_preference_order IS 'Ordered array of sports by user preference (index 0 = most preferred)';
COMMENT ON COLUMN users.onboarding_completed IS 'Whether the user has completed the initial sport preference onboarding';

-- Create an index for better query performance on sport preferences
CREATE INDEX IF NOT EXISTS idx_users_preferred_sports ON users USING GIN (preferred_sports);
CREATE INDEX IF NOT EXISTS idx_users_sport_preference_order ON users USING GIN (sport_preference_order);

-- Update existing users to have basketball as default if no preferences set
UPDATE users 
SET preferred_sports = ARRAY['basketball']::TEXT[]
WHERE preferred_sports IS NULL OR array_length(preferred_sports, 1) IS NULL;

UPDATE users 
SET sport_preference_order = ARRAY['basketball']::TEXT[]
WHERE sport_preference_order IS NULL OR array_length(sport_preference_order, 1) IS NULL;
