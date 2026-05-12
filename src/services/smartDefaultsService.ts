import { supabase } from './supabase';
import { Sport } from '../types';

export interface SessionDefaults {
  preferredSport: Sport | null;
  preferredTime: string; // e.g., "18:00"
  preferredDay: string; // e.g., "Saturday"
  suggestedMaxPlayers: number;
  suggestedDuration: number; // minutes
  suggestedSkillLevel: string;
}

export interface UserPlayHistory {
  totalSessions: number;
  mostPlayedSport: Sport | null;
  favoriteTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  favoriteDayOfWeek: string;
  averageSessionSize: number;
  lastPlayedAt: string | null;
}

export class SmartDefaultsService {
  /**
   * Get smart defaults for session creation
   */
  static async getSessionDefaults(userId: string): Promise<SessionDefaults> {
    try {
      const history = await this.getUserPlayHistory(userId);
      
      // Calculate suggested time based on history
      const timeMap = {
        morning: '09:00',
        afternoon: '14:00',
        evening: '18:00',
        night: '20:00',
      };

      // Get user's preferred sports from profile
      const { data: userData } = await supabase
        .from('users')
        .select('preferred_sports, sport_preference_order')
        .eq('id', userId)
        .single();

      const preferredSport = history.mostPlayedSport || 
        (userData?.sport_preference_order?.[0] as Sport) ||
        (userData?.preferred_sports?.[0] as Sport) ||
        null;

      return {
        preferredSport,
        preferredTime: timeMap[history.favoriteTimeOfDay] || '18:00',
        preferredDay: history.favoriteDayOfWeek || 'Saturday',
        suggestedMaxPlayers: Math.max(4, Math.round(history.averageSessionSize * 1.5)) || 8,
        suggestedDuration: 90, // Default 90 minutes
        suggestedSkillLevel: 'All Levels', // Default to inclusive
      };
    } catch (error) {
      console.error('Error getting session defaults:', error);
      return this.getDefaultDefaults();
    }
  }

  /**
   * Get user's play history for analysis
   */
  static async getUserPlayHistory(userId: string): Promise<UserPlayHistory> {
    try {
      // Get user's session participation history
      const { data: participations, error } = await supabase
        .from('session_participants')
        .select(`
          session_id,
          status,
          sessions:session_id (
            sport,
            scheduled_for,
            current_players,
            status
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'in');

      if (error || !participations || participations.length === 0) {
        return this.getDefaultHistory();
      }

      // Analyze sports frequency
      const sportCounts: Record<string, number> = {};
      const hourCounts: Record<string, number> = {};
      const dayCounts: Record<string, number> = {};
      let totalPlayers = 0;
      let lastPlayed: string | null = null;

      participations.forEach(p => {
        const session = p.sessions as any;
        if (!session) return;

        // Count sports
        sportCounts[session.sport] = (sportCounts[session.sport] || 0) + 1;

        // Count hours and days
        const date = new Date(session.scheduled_for);
        const hour = date.getHours();
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });

        const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 20 ? 'evening' : 'night';
        hourCounts[timeOfDay] = (hourCounts[timeOfDay] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;

        totalPlayers += session.current_players || 0;

        if (!lastPlayed || date > new Date(lastPlayed)) {
          lastPlayed = session.scheduled_for;
        }
      });

      // Find most common values
      const mostPlayedSport = Object.entries(sportCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] as Sport || null;

      const favoriteTimeOfDay = (Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'evening') as UserPlayHistory['favoriteTimeOfDay'];

      const favoriteDayOfWeek = Object.entries(dayCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Saturday';

      return {
        totalSessions: participations.length,
        mostPlayedSport,
        favoriteTimeOfDay,
        favoriteDayOfWeek,
        averageSessionSize: Math.round(totalPlayers / participations.length) || 6,
        lastPlayedAt: lastPlayed,
      };
    } catch (error) {
      console.error('Error getting play history:', error);
      return this.getDefaultHistory();
    }
  }

  /**
   * Get suggested title based on sport and context
   */
  static getSuggestedTitle(sport: Sport, timeOfDay: string): string {
    const sportNames: Record<Sport, string> = {
      basketball: 'Basketball',
      soccer: 'Soccer',
      tennis: 'Tennis',
      volleyball: 'Volleyball',
      pickleball: 'Pickleball',
      badminton: 'Badminton',
    };

    const timeDescriptors: Record<string, string> = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
    };

    const sportName = sportNames[sport] || sport;
    const timeDesc = timeDescriptors[timeOfDay] || '';

    const templates = [
      `${timeDesc} ${sportName}`,
      `Casual ${sportName} Game`,
      `${sportName} Pickup`,
      `${sportName} Session`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Get suggested time slots based on day
   */
  static getSuggestedTimeSlots(dayOfWeek: string): string[] {
    const isWeekend = ['Saturday', 'Sunday'].includes(dayOfWeek);
    
    if (isWeekend) {
      return ['09:00', '11:00', '14:00', '16:00', '18:00'];
    } else {
      return ['06:00', '12:00', '17:00', '18:30', '20:00'];
    }
  }

  /**
   * Get max players suggestion based on sport
   */
  static getMaxPlayersSuggestion(sport: Sport): number {
    const sportMaxPlayers: Record<Sport, number> = {
      basketball: 10,
      soccer: 14,
      tennis: 4,
      volleyball: 12,
      pickleball: 8,
      badminton: 4,
    };

    return sportMaxPlayers[sport] || 10;
  }

  private static getDefaultDefaults(): SessionDefaults {
    return {
      preferredSport: null,
      preferredTime: '18:00',
      preferredDay: 'Saturday',
      suggestedMaxPlayers: 8,
      suggestedDuration: 90,
      suggestedSkillLevel: 'All Levels',
    };
  }

  private static getDefaultHistory(): UserPlayHistory {
    return {
      totalSessions: 0,
      mostPlayedSport: null,
      favoriteTimeOfDay: 'evening',
      favoriteDayOfWeek: 'Saturday',
      averageSessionSize: 6,
      lastPlayedAt: null,
    };
  }
}

export default SmartDefaultsService;
