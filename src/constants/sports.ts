import { SportConfig, Sport } from '../types';

// MaterialCommunityIcons glyphs per sport (used by map markers and chips)
export const SPORT_GLYPHS: Record<Sport, string> = {
  basketball: 'basketball',
  tennis: 'tennis-ball',
  pickleball: 'racquetball',
  volleyball: 'volleyball',
  soccer: 'soccer',
  badminton: 'badminton',
};

// Vibrant gradient pairs for marker pins (start, end)
export const SPORT_GRADIENTS: Record<Sport, [string, string]> = {
  basketball: ['#FF8A4C', '#F25C1F'],
  tennis: ['#7BD66B', '#34A853'],
  pickleball: ['#B57CE0', '#7B36C9'],
  volleyball: ['#5BB7FF', '#1E78F2'],
  soccer: ['#9D7B5C', '#5A3B22'],
  badminton: ['#5DD9E3', '#0095A8'],
};

export const SPORTS_CONFIG: Record<Sport, SportConfig> = {
  basketball: {
    name: 'Basketball',
    icon: '🏀',
    color: '#F25C1F',
    defaultSessionTitle: 'Open Run',
    maxPlayers: 10,
  },
  tennis: {
    name: 'Tennis',
    icon: '🎾',
    color: '#34A853',
    defaultSessionTitle: 'Looking for Partner',
    maxPlayers: 4,
  },
  pickleball: {
    name: 'Pickleball',
    icon: '🏓',
    color: '#7B36C9',
    defaultSessionTitle: 'Pickleball Game',
    maxPlayers: 4,
  },
  volleyball: {
    name: 'Volleyball',
    icon: '🏐',
    color: '#1E78F2',
    defaultSessionTitle: 'Volleyball Match',
    maxPlayers: 12,
  },
  soccer: {
    name: 'Soccer',
    icon: '⚽',
    color: '#5A3B22',
    defaultSessionTitle: 'Pickup Game',
    maxPlayers: 22,
  },
  badminton: {
    name: 'Badminton',
    icon: '🏸',
    color: '#0095A8',
    defaultSessionTitle: 'Badminton Session',
    maxPlayers: 4,
  },
};

export const SPORT_FILTERS = Object.keys(SPORTS_CONFIG) as Sport[];

/** Explicit list for validation / stripping legacy DB values */
export const ACTIVE_SPORTS = SPORT_FILTERS;

const SPORT_SET = new Set<string>(ACTIVE_SPORTS);

export function isSport(value: string): value is Sport {
  return SPORT_SET.has(value);
}

/** Maps legacy or unknown tags to a valid Sport, or null */
export function coerceSport(value: string | null | undefined): Sport | null {
  if (value == null || value === '') return null;
  return isSport(value) ? value : null;
}

export const DEFAULT_MAP_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};
