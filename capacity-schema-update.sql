-- Add capacity tracking table to existing Ralli schema
-- Run this in your Supabase SQL editor after the main schema

-- Facility capacity tracking table
CREATE TABLE facility_capacity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  facility_id TEXT NOT NULL, -- This can be either our court ID or Google Places ID
  occupancy_percentage INTEGER NOT NULL CHECK (occupancy_percentage >= 0 AND occupancy_percentage <= 100),
  occupancy_level TEXT NOT NULL CHECK (occupancy_level IN ('low', 'medium', 'high', 'full')),
  sport TEXT NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_facility_capacity_facility_id ON facility_capacity(facility_id);
CREATE INDEX idx_facility_capacity_reported_at ON facility_capacity(reported_at);
CREATE INDEX idx_facility_capacity_sport ON facility_capacity(sport);
CREATE INDEX idx_facility_capacity_user_id ON facility_capacity(user_id);

-- Composite index for getting latest capacity by facility and sport
CREATE INDEX idx_facility_capacity_latest ON facility_capacity(facility_id, sport, reported_at DESC);

-- Row Level Security
ALTER TABLE facility_capacity ENABLE ROW LEVEL SECURITY;

-- Capacity reporting policies
CREATE POLICY "Users can view all capacity reports" ON facility_capacity FOR SELECT USING (true);
CREATE POLICY "Users can create capacity reports" ON facility_capacity FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own capacity reports" ON facility_capacity FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own capacity reports" ON facility_capacity FOR DELETE USING (auth.uid() = user_id);

-- Function to clean up old capacity reports (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_capacity_reports()
RETURNS void AS $$
BEGIN
  DELETE FROM facility_capacity 
  WHERE reported_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to clean up old reports
-- You can set this up in Supabase Dashboard > Database > Cron Jobs
-- SELECT cron.schedule('cleanup-capacity-reports', '0 2 * * *', 'SELECT cleanup_old_capacity_reports();');
