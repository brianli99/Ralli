import { Court } from '../types';

export const sampleCourts: Omit<Court, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Mission Dolores Park Basketball Courts',
    description: 'Popular outdoor courts with great city views. Gets busy on weekends.',
    latitude: 37.7596,
    longitude: -122.4269,
    sports: ['basketball'],
    address: '19th St & Dolores St, San Francisco, CA',
    amenities: ['Outdoor courts', 'Free parking', 'Restrooms nearby', 'Water fountain']
  },
  {
    name: 'Golden Gate Park Tennis Courts',
    description: 'Well-maintained public tennis courts in the heart of Golden Gate Park.',
    latitude: 37.7694,
    longitude: -122.4862,
    sports: ['tennis', 'pickleball'],
    address: 'Golden Gate Park, San Francisco, CA',
    amenities: ['Multiple courts', 'Pro shop', 'Lessons available', 'Parking']
  },
  {
    name: 'Crissy Field Sports Fields',
    description: 'Large open fields perfect for soccer, volleyball, and running groups.',
    latitude: 37.8021,
    longitude: -122.4662,
    sports: ['soccer', 'volleyball', 'running'],
    address: 'Crissy Field, San Francisco, CA',
    amenities: ['Open fields', 'Bay views', 'Parking', 'Restrooms', 'Picnic areas']
  },
  {
    name: 'Presidio Wall Volleyball Courts',
    description: 'Sand volleyball courts with a fun, social atmosphere.',
    latitude: 37.7955,
    longitude: -122.4458,
    sports: ['volleyball'],
    address: '3150 Lyon St, San Francisco, CA',
    amenities: ['Sand courts', 'Net rentals', 'Lighting', 'Parking']
  },
  {
    name: 'Embarcadero Pickleball Courts',
    description: 'New pickleball courts along the waterfront with stunning views.',
    latitude: 37.7955,
    longitude: -122.3937,
    sports: ['pickleball', 'tennis'],
    address: 'Embarcadero, San Francisco, CA',
    amenities: ['Waterfront views', 'New courts', 'Equipment rental', 'Parking']
  },
  {
    name: 'Marina Green Running Path',
    description: 'Popular running spot with bay views and organized group runs.',
    latitude: 37.8040,
    longitude: -122.4430,
    sports: ['running'],
    address: 'Marina Blvd, San Francisco, CA',
    amenities: ['Scenic route', 'Flat terrain', 'Water stations', 'Group meetups']
  },
  {
    name: 'Balboa Park Basketball Courts',
    description: 'Community courts popular with local players. Great for pickup games.',
    latitude: 37.7211,
    longitude: -122.4584,
    sports: ['basketball'],
    address: '747 Balboa Dr, San Francisco, CA',
    amenities: ['Multiple courts', 'Good lighting', 'Free parking', 'Nearby cafe']
  },
  {
    name: 'Sunset Playground Multi-Sport Courts',
    description: 'Versatile courts supporting multiple sports in the Sunset district.',
    latitude: 37.7394,
    longitude: -122.4813,
    sports: ['basketball', 'tennis', 'volleyball'],
    address: '2201 Lawton St, San Francisco, CA',
    amenities: ['Multi-sport', 'Playground nearby', 'Parking', 'Family-friendly']
  }
];

export const createSampleCourts = `
-- Sample courts for Ralli app
INSERT INTO courts (name, description, latitude, longitude, sports, address, amenities) VALUES
('Mission Dolores Park Basketball Courts', 'Popular outdoor courts with great city views. Gets busy on weekends.', 37.7596, -122.4269, ARRAY['basketball'], '19th St & Dolores St, San Francisco, CA', ARRAY['Outdoor courts', 'Free parking', 'Restrooms nearby', 'Water fountain']),
('Golden Gate Park Tennis Courts', 'Well-maintained public tennis courts in the heart of Golden Gate Park.', 37.7694, -122.4862, ARRAY['tennis', 'pickleball'], 'Golden Gate Park, San Francisco, CA', ARRAY['Multiple courts', 'Pro shop', 'Lessons available', 'Parking']),
('Crissy Field Sports Fields', 'Large open fields perfect for soccer, volleyball, and running groups.', 37.8021, -122.4662, ARRAY['soccer', 'volleyball', 'running'], 'Crissy Field, San Francisco, CA', ARRAY['Open fields', 'Bay views', 'Parking', 'Restrooms', 'Picnic areas']),
('Presidio Wall Volleyball Courts', 'Sand volleyball courts with a fun, social atmosphere.', 37.7955, -122.4458, ARRAY['volleyball'], '3150 Lyon St, San Francisco, CA', ARRAY['Sand courts', 'Net rentals', 'Lighting', 'Parking']),
('Embarcadero Pickleball Courts', 'New pickleball courts along the waterfront with stunning views.', 37.7955, -122.3937, ARRAY['pickleball', 'tennis'], 'Embarcadero, San Francisco, CA', ARRAY['Waterfront views', 'New courts', 'Equipment rental', 'Parking']),
('Marina Green Running Path', 'Popular running spot with bay views and organized group runs.', 37.8040, -122.4430, ARRAY['running'], 'Marina Blvd, San Francisco, CA', ARRAY['Scenic route', 'Flat terrain', 'Water stations', 'Group meetups']),
('Balboa Park Basketball Courts', 'Community courts popular with local players. Great for pickup games.', 37.7211, -122.4584, ARRAY['basketball'], '747 Balboa Dr, San Francisco, CA', ARRAY['Multiple courts', 'Good lighting', 'Free parking', 'Nearby cafe']),
('Sunset Playground Multi-Sport Courts', 'Versatile courts supporting multiple sports in the Sunset district.', 37.7394, -122.4813, ARRAY['basketball', 'tennis', 'volleyball'], '2201 Lawton St, San Francisco, CA', ARRAY['Multi-sport', 'Playground nearby', 'Parking', 'Family-friendly']);
`;
