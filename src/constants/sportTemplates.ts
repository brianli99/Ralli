// ============================================================================
// SPORT-SPECIFIC TEMPLATES FOR SQUAD SYSTEM
// ============================================================================

import { SportTemplate, MatchFormatOption, SportCode } from '../types/squad.types';

// ============================================================================
// MATCH FORMAT OPTIONS BY SPORT
// ============================================================================

const basketballFormats: MatchFormatOption[] = [
  {
    id: 'full_court_5v5',
    name: '5v5 Full Court',
    description: 'Standard full court basketball game',
    settings: { quarters: 4, quarter_length: 12, timeouts: 6 },
    max_participants: 10,
    team_sides: 2
  },
  {
    id: 'half_court_3v3',
    name: '3v3 Half Court',
    description: 'Half court pickup game',
    settings: { game_to: 21, win_by: 2, timeouts: 2 },
    max_participants: 6,
    team_sides: 2
  },
  {
    id: 'streetball_4v4',
    name: '4v4 Streetball',
    description: 'Streetball format game',
    settings: { game_to: 15, win_by: 1, make_it_take_it: true },
    max_participants: 8,
    team_sides: 2
  }
];

const tennisFormats: MatchFormatOption[] = [
  {
    id: 'singles',
    name: 'Singles Match',
    description: 'One-on-one tennis match',
    settings: { sets: 3, games_per_set: 6, tiebreak: 7, advantage: true },
    max_participants: 2,
    team_sides: 2
  },
  {
    id: 'doubles',
    name: 'Doubles Match',
    description: 'Two-on-two tennis match',
    settings: { sets: 3, games_per_set: 6, tiebreak: 7, advantage: true },
    max_participants: 4,
    team_sides: 2
  },
  {
    id: 'mixed_doubles',
    name: 'Mixed Doubles',
    description: 'Mixed gender doubles match',
    settings: { sets: 3, games_per_set: 6, tiebreak: 7, advantage: true },
    max_participants: 4,
    team_sides: 2
  }
];

const pickleballFormats: MatchFormatOption[] = [
  {
    id: 'singles',
    name: 'Singles Match',
    description: 'One-on-one pickleball match',
    settings: { game_to: 11, win_by: 2, serve_rotation: 'traditional' },
    max_participants: 2,
    team_sides: 2
  },
  {
    id: 'doubles',
    name: 'Doubles Match',
    description: 'Two-on-two pickleball match',
    settings: { game_to: 11, win_by: 2, serve_rotation: 'doubles' },
    max_participants: 4,
    team_sides: 2
  },
  {
    id: 'tournament_doubles',
    name: 'Tournament Doubles',
    description: 'Best of 3 tournament format',
    settings: { games: 3, game_to: 11, win_by: 2, serve_rotation: 'doubles' },
    max_participants: 4,
    team_sides: 2
  }
];

const volleyballFormats: MatchFormatOption[] = [
  {
    id: 'indoor_6v6',
    name: '6v6 Indoor',
    description: 'Standard indoor volleyball',
    settings: { sets: 5, points_per_set: 25, final_set_to: 15, win_by: 2 },
    max_participants: 12,
    team_sides: 2
  },
  {
    id: 'beach_2v2',
    name: '2v2 Beach',
    description: 'Beach volleyball format',
    settings: { sets: 3, points_per_set: 21, final_set_to: 15, win_by: 2 },
    max_participants: 4,
    team_sides: 2
  },
  {
    id: 'grass_4v4',
    name: '4v4 Grass',
    description: 'Grass court volleyball',
    settings: { sets: 3, points_per_set: 25, final_set_to: 15, win_by: 2 },
    max_participants: 8,
    team_sides: 2
  }
];

const soccerFormats: MatchFormatOption[] = [
  {
    id: 'full_field_11v11',
    name: '11v11 Full Field',
    description: 'Standard soccer match',
    settings: { halves: 2, half_length: 45, substitutions: 5, offside: true },
    max_participants: 22,
    team_sides: 2
  },
  {
    id: 'small_sided_7v7',
    name: '7v7 Small Sided',
    description: 'Small sided soccer game',
    settings: { halves: 2, half_length: 30, substitutions: 3, offside: true },
    max_participants: 14,
    team_sides: 2
  },
  {
    id: 'futsal_5v5',
    name: '5v5 Futsal',
    description: 'Indoor futsal format',
    settings: { halves: 2, half_length: 20, substitutions: 'unlimited', offside: false },
    max_participants: 10,
    team_sides: 2
  }
];

// ============================================================================
// SPORT TEMPLATES
// ============================================================================

export const SPORT_TEMPLATES: Record<SportCode, SportTemplate> = {
  basketball: {
    sport_code: 'basketball',
    name: 'Basketball',
    icon: '🏀',
    color: '#ff8c00',
    positions: [
      'Point Guard',
      'Shooting Guard', 
      'Small Forward',
      'Power Forward',
      'Center'
    ],
    default_match_settings: {
      quarters: 4,
      quarter_length: 12,
      timeouts: 6,
      shot_clock: 24
    },
    match_format_options: basketballFormats
  },

  tennis: {
    sport_code: 'tennis',
    name: 'Tennis',
    icon: '🎾',
    color: '#32cd32',
    positions: [
      'Singles Player',
      'Doubles Partner 1',
      'Doubles Partner 2'
    ],
    default_match_settings: {
      sets: 3,
      games_per_set: 6,
      tiebreak: 7,
      advantage: true
    },
    match_format_options: tennisFormats
  },

  pickleball: {
    sport_code: 'pickleball',
    name: 'Pickleball',
    icon: '🏓',
    color: '#ffd700',
    positions: [
      'Singles Player',
      'Doubles Partner 1',
      'Doubles Partner 2'
    ],
    default_match_settings: {
      game_to: 11,
      win_by: 2,
      serve_rotation: 'doubles'
    },
    match_format_options: pickleballFormats
  },

  volleyball: {
    sport_code: 'volleyball',
    name: 'Volleyball',
    icon: '🏐',
    color: '#1e90ff',
    positions: [
      'Outside Hitter',
      'Middle Blocker',
      'Opposite Hitter',
      'Setter',
      'Libero',
      'Defensive Specialist'
    ],
    default_match_settings: {
      sets: 5,
      points_per_set: 25,
      final_set_to: 15,
      win_by: 2
    },
    match_format_options: volleyballFormats
  },

  soccer: {
    sport_code: 'soccer',
    name: 'Soccer',
    icon: '⚽',
    color: '#228b22',
    positions: [
      'Goalkeeper',
      'Center Back',
      'Full Back',
      'Defensive Midfielder',
      'Central Midfielder',
      'Attacking Midfielder',
      'Winger',
      'Striker'
    ],
    default_match_settings: {
      halves: 2,
      half_length: 45,
      substitutions: 5,
      offside: true
    },
    match_format_options: soccerFormats
  },

  badminton: {
    sport_code: 'badminton',
    name: 'Badminton',
    icon: '🏸',
    color: '#00bcd4',
    positions: ['Singles', 'Doubles'],
    default_match_settings: {
      sets: 3,
      points_per_set: 21,
      win_by_two: true,
    },
    match_format_options: [
      { id: 'singles', name: 'Singles', description: '1v1 badminton match', settings: { sets: 3, points_per_set: 21, win_by: 2 }, max_participants: 2, team_sides: 2 },
      { id: 'doubles', name: 'Doubles', description: '2v2 badminton match', settings: { sets: 3, points_per_set: 21, win_by: 2 }, max_participants: 4, team_sides: 2 },
    ]
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getSportTemplate = (sportCode: SportCode): SportTemplate => {
  return SPORT_TEMPLATES[sportCode];
};

export const getSportColor = (sportCode: SportCode): string => {
  return SPORT_TEMPLATES[sportCode].color;
};

export const getSportIcon = (sportCode: SportCode): string => {
  return SPORT_TEMPLATES[sportCode].icon;
};

export const getSportPositions = (sportCode: SportCode): string[] => {
  return SPORT_TEMPLATES[sportCode].positions;
};

export const getMatchFormats = (sportCode: SportCode): MatchFormatOption[] => {
  return SPORT_TEMPLATES[sportCode].match_format_options;
};

export const getDefaultMatchSettings = (sportCode: SportCode): Record<string, any> => {
  return SPORT_TEMPLATES[sportCode].default_match_settings;
};

// ============================================================================
// SQUAD CUSTOMIZATION THEMES
// ============================================================================

export const SQUAD_THEME_COLORS = [
  '#1a73e8', // Default blue
  '#ff8c00', // Basketball orange
  '#32cd32', // Tennis green
  '#ffd700', // Pickleball yellow
  '#1e90ff', // Volleyball blue
  '#228b22', // Soccer green
  '#9c27b0', // Purple
  '#e91e63', // Pink
  '#00bcd4', // Cyan
  '#4caf50', // Green
  '#ff9800', // Orange
  '#795548', // Brown
  '#607d8b', // Blue Grey
];

export const getRandomThemeColor = (): string => {
  return SQUAD_THEME_COLORS[Math.floor(Math.random() * SQUAD_THEME_COLORS.length)];
};

export const getSportThemeColor = (sportCode: SportCode): string => {
  return getSportColor(sportCode);
};
