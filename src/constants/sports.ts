import { SportConfig, Sport } from '../types';

export const SPORTS_CONFIG: Record<Sport, SportConfig> = {
  basketball: {
    name: 'Basketball',
    icon: '🏀',
    color: '#FF6B35',
    defaultSessionTitle: 'Open Run',
    maxPlayers: 10,
  },
  tennis: {
    name: 'Tennis',
    icon: '🎾',
    color: '#4CAF50',
    defaultSessionTitle: 'Looking for Partner',
    maxPlayers: 4,
  },
  pickleball: {
    name: 'Pickleball',
    icon: '🏓',
    color: '#9C27B0',
    defaultSessionTitle: 'Pickleball Game',
    maxPlayers: 4,
  },
  volleyball: {
    name: 'Volleyball',
    icon: '🏐',
    color: '#2196F3',
    defaultSessionTitle: 'Volleyball Match',
    maxPlayers: 12,
  },
  running: {
    name: 'Running',
    icon: '🏃',
    color: '#FF9800',
    defaultSessionTitle: 'Group Run',
    maxPlayers: 20,
  },
  soccer: {
    name: 'Soccer',
    icon: '⚽',
    color: '#795548',
    defaultSessionTitle: 'Pickup Game',
    maxPlayers: 22,
  },
};

export const SPORT_FILTERS = Object.keys(SPORTS_CONFIG) as Sport[];

export const DEFAULT_MAP_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};
