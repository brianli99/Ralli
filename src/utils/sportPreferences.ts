import { Sport } from '../types';

/**
 * Orders an array of sports based on user preferences
 * @param sports - Array of sports to order
 * @param userPreferences - User's sport preference order (most preferred first)
 * @returns Sports array ordered by user preference, with unpreferred sports at the end
 */
export function orderSportsByPreference(
  sports: string[], 
  userPreferences: string[] = []
): string[] {
  if (!userPreferences.length) {
    return sports;
  }

  // Create a map for preference ordering (lower index = higher preference)
  const preferenceMap = new Map<string, number>();
  userPreferences.forEach((sport, index) => {
    preferenceMap.set(sport, index);
  });

  // Sort sports based on user preferences
  return sports.sort((a, b) => {
    const aPreference = preferenceMap.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bPreference = preferenceMap.get(b) ?? Number.MAX_SAFE_INTEGER;
    
    // If preferences are equal, maintain original order
    if (aPreference === bPreference) {
      return 0;
    }
    
    return aPreference - bPreference;
  });
}

/**
 * Gets the user's most preferred sport from a list of available sports
 * @param availableSports - Sports available at a facility
 * @param userPreferences - User's sport preference order
 * @returns The most preferred sport that's available, or the first sport if none match
 */
export function getMostPreferredSport(
  availableSports: string[], 
  userPreferences: string[] = []
): string {
  if (!userPreferences.length || !availableSports.length) {
    return availableSports[0] || 'basketball';
  }

  // Find the first preference that exists in available sports
  for (const preferredSport of userPreferences) {
    if (availableSports.includes(preferredSport)) {
      return preferredSport;
    }
  }

  // If no preferences match, return the first available sport
  return availableSports[0];
}

/**
 * Checks if a sport is in the user's preferences
 * @param sport - Sport to check
 * @param userPreferences - User's sport preferences
 * @returns True if the sport is preferred by the user
 */
export function isSportPreferred(sport: string, userPreferences: string[] = []): boolean {
  return userPreferences.includes(sport);
}

/**
 * Gets the preference rank of a sport (0 = most preferred)
 * @param sport - Sport to check
 * @param userPreferences - User's sport preference order
 * @returns Preference rank (0-based) or -1 if not preferred
 */
export function getSportPreferenceRank(sport: string, userPreferences: string[] = []): number {
  const index = userPreferences.indexOf(sport);
  return index;
}

/**
 * Validates and filters sport preferences to only include valid sports
 * @param preferences - Array of sport preferences
 * @param validSports - Array of valid sport values
 * @returns Filtered array containing only valid sports
 */
export function validateSportPreferences(
  preferences: string[], 
  validSports: Sport[]
): Sport[] {
  return preferences.filter((sport): sport is Sport => 
    validSports.includes(sport as Sport)
  );
}
