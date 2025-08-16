-- Ralli Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  preferred_sports TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courts table
CREATE TABLE courts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  sports TEXT[] NOT NULL DEFAULT '{}',
  address TEXT NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check-ins table
CREATE TABLE check_ins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  court_id UUID REFERENCES courts(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  sport TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  court_id UUID REFERENCES courts(id) ON DELETE CASCADE NOT NULL,
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
CREATE TABLE session_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in' CHECK (status IN ('in', 'out', 'maybe')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Indexes for better performance
CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX idx_check_ins_court_id ON check_ins(court_id);
CREATE INDEX idx_check_ins_created_at ON check_ins(created_at);
CREATE INDEX idx_sessions_creator_id ON sessions(creator_id);
CREATE INDEX idx_sessions_court_id ON sessions(court_id);
CREATE INDEX idx_sessions_scheduled_for ON sessions(scheduled_for);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- Users can read all user profiles but only update their own
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Courts are public read-only for now
CREATE POLICY "Courts are viewable by everyone" ON courts FOR SELECT USING (true);

-- Check-ins policies
CREATE POLICY "Users can view all check-ins" ON check_ins FOR SELECT USING (true);
CREATE POLICY "Users can create their own check-ins" ON check_ins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own check-ins" ON check_ins FOR DELETE USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Users can view all sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Users can create sessions" ON sessions FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Session creators can update their sessions" ON sessions FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Session creators can delete their sessions" ON sessions FOR DELETE USING (auth.uid() = creator_id);

-- Session participants policies
CREATE POLICY "Users can view all session participants" ON session_participants FOR SELECT USING (true);
CREATE POLICY "Users can join sessions" ON session_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON session_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave sessions" ON session_participants FOR DELETE USING (auth.uid() = user_id);

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
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courts_updated_at BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample courts
INSERT INTO courts (name, description, latitude, longitude, sports, address, amenities) VALUES
('Mission Dolores Park Basketball Courts', 'Popular outdoor courts with great city views. Gets busy on weekends.', 37.7596, -122.4269, ARRAY['basketball'], '19th St & Dolores St, San Francisco, CA', ARRAY['Outdoor courts', 'Free parking', 'Restrooms nearby', 'Water fountain']),
('Golden Gate Park Tennis Courts', 'Well-maintained public tennis courts in the heart of Golden Gate Park.', 37.7694, -122.4862, ARRAY['tennis', 'pickleball'], 'Golden Gate Park, San Francisco, CA', ARRAY['Multiple courts', 'Pro shop', 'Lessons available', 'Parking']),
('Crissy Field Sports Fields', 'Large open fields perfect for soccer, volleyball, and running groups.', 37.8021, -122.4662, ARRAY['soccer', 'volleyball', 'running'], 'Crissy Field, San Francisco, CA', ARRAY['Open fields', 'Bay views', 'Parking', 'Restrooms', 'Picnic areas']),
('Presidio Wall Volleyball Courts', 'Sand volleyball courts with a fun, social atmosphere.', 37.7955, -122.4458, ARRAY['volleyball'], '3150 Lyon St, San Francisco, CA', ARRAY['Sand courts', 'Net rentals', 'Lighting', 'Parking']),
('Embarcadero Pickleball Courts', 'New pickleball courts along the waterfront with stunning views.', 37.7955, -122.3937, ARRAY['pickleball', 'tennis'], 'Embarcadero, San Francisco, CA', ARRAY['Waterfront views', 'New courts', 'Equipment rental', 'Parking']),
('Marina Green Running Path', 'Popular running spot with bay views and organized group runs.', 37.8040, -122.4430, ARRAY['running'], 'Marina Blvd, San Francisco, CA', ARRAY['Scenic route', 'Flat terrain', 'Water stations', 'Group meetups']),
('Balboa Park Basketball Courts', 'Community courts popular with local players. Great for pickup games.', 37.7211, -122.4584, ARRAY['basketball'], '747 Balboa Dr, San Francisco, CA', ARRAY['Multiple courts', 'Good lighting', 'Free parking', 'Nearby cafe']),
('Sunset Playground Multi-Sport Courts', 'Versatile courts supporting multiple sports in the Sunset district.', 37.7394, -122.4813, ARRAY['basketball', 'tennis', 'volleyball'], '2201 Lawton St, San Francisco, CA', ARRAY['Multi-sport', 'Playground nearby', 'Parking', 'Family-friendly']);
