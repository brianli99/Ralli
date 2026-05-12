import { supabase } from './supabase';

export interface FriendActivity {
  friendId: string;
  friendName: string;
  lastVisit: string;
  sport?: string;
}

export interface HostBadge {
  type: 'new' | 'reliable' | 'superhost' | 'veteran';
  label: string;
  color: string;
  sessionsHosted: number;
}

export interface FacilitySocialProof {
  friendsWhoPlayed: FriendActivity[];
  totalFriendVisits: number;
  returningPlayersPercent: number;
  popularTimes: string[];
}

export interface HostStats {
  userId: string;
  sessionsHosted: number;
  completionRate: number;
  avgAttendance: number;
  badge: HostBadge;
}

export class SocialProofService {
  /**
   * Get friends who have played at a facility
   */
  static async getFriendsAtFacility(
    userId: string,
    facilityId: string,
    limit: number = 5
  ): Promise<FriendActivity[]> {
    try {
      // Get user's friends
      const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (friendError || !friendships || friendships.length === 0) {
        return [];
      }

      // Extract friend IDs
      const friendIds = friendships.map(f => 
        f.user_id === userId ? f.friend_id : f.user_id
      );

      // Prefer friends currently checked in (active presence); fall back to recent rows if column missing
      const activeQuery = supabase
        .from('check_ins')
        .select(
          `
          user_id,
          sport,
          created_at,
          users:user_id (full_name, email)
        `
        )
        .eq('google_place_id', facilityId)
        .in('user_id', friendIds)
        .is('checked_out_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.max(limit * 2, 10));

      let { data: checkIns, error: checkInError } = await activeQuery;

      if (checkInError && String((checkInError as any).message || '').includes('checked_out_at')) {
        const recent = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const r2 = await supabase
          .from('check_ins')
          .select(
            `
          user_id,
          sport,
          created_at,
          users:user_id (full_name, email)
        `
          )
          .eq('google_place_id', facilityId)
          .in('user_id', friendIds)
          .gte('created_at', recent)
          .order('created_at', { ascending: false })
          .limit(Math.max(limit * 2, 10));
        checkIns = r2.data;
        checkInError = r2.error;
      }

      if (checkInError || !checkIns) {
        return [];
      }

      // Deduplicate by friend (keep most recent)
      const seenFriends = new Set<string>();
      const friendActivities: FriendActivity[] = [];

      for (const checkIn of checkIns) {
        if (!seenFriends.has(checkIn.user_id)) {
          seenFriends.add(checkIn.user_id);
          const userData = checkIn.users as any;
          friendActivities.push({
            friendId: checkIn.user_id,
            friendName: userData?.full_name || userData?.email?.split('@')[0] || 'Friend',
            lastVisit: checkIn.created_at,
            sport: checkIn.sport,
          });
        }
      }

      return friendActivities;
    } catch (error) {
      console.error('Error fetching friends at facility:', error);
      return [];
    }
  }

  /**
   * Get social proof data for a facility
   */
  static async getFacilitySocialProof(
    userId: string,
    facilityId: string
  ): Promise<FacilitySocialProof> {
    try {
      const [friendsWhoPlayed, returningStats] = await Promise.all([
        this.getFriendsAtFacility(userId, facilityId),
        this.getReturningPlayersStats(facilityId),
      ]);

      return {
        friendsWhoPlayed,
        totalFriendVisits: friendsWhoPlayed.length,
        returningPlayersPercent: returningStats.percent,
        popularTimes: returningStats.popularTimes,
      };
    } catch (error) {
      console.error('Error fetching facility social proof:', error);
      return {
        friendsWhoPlayed: [],
        totalFriendVisits: 0,
        returningPlayersPercent: 0,
        popularTimes: [],
      };
    }
  }

  /**
   * Calculate returning players percentage
   */
  static async getReturningPlayersStats(facilityId: string): Promise<{
    percent: number;
    popularTimes: string[];
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select('user_id, created_at')
        .eq('google_place_id', facilityId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error || !checkIns || checkIns.length === 0) {
        return { percent: 0, popularTimes: [] };
      }

      // Count visits per user
      const userVisits: Record<string, number> = {};
      const hourCounts: Record<number, number> = {};

      checkIns.forEach(c => {
        userVisits[c.user_id] = (userVisits[c.user_id] || 0) + 1;
        const hour = new Date(c.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      // Calculate returning players (visited more than once)
      const totalUsers = Object.keys(userVisits).length;
      const returningUsers = Object.values(userVisits).filter(v => v > 1).length;
      const percent = totalUsers > 0 ? Math.round((returningUsers / totalUsers) * 100) : 0;

      // Get top 3 popular times
      const sortedHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => `${hour.padStart(2, '0')}:00`);

      return { percent, popularTimes: sortedHours };
    } catch (error) {
      console.error('Error calculating returning players:', error);
      return { percent: 0, popularTimes: [] };
    }
  }

  /**
   * Get host stats and badge
   */
  static async getHostStats(hostId: string): Promise<HostStats> {
    try {
      // Get all sessions by this host
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('id, status, max_players, current_players')
        .eq('creator_id', hostId);

      if (error || !sessions) {
        return this.createDefaultHostStats(hostId);
      }

      const sessionsHosted = sessions.length;
      const completedSessions = sessions.filter(s => s.status === 'completed').length;
      const cancelledSessions = sessions.filter(s => s.status === 'cancelled').length;
      
      const completionRate = sessionsHosted > 0 
        ? Math.round(((sessionsHosted - cancelledSessions) / sessionsHosted) * 100)
        : 100;

      const avgAttendance = sessions.length > 0
        ? sessions.reduce((acc, s) => acc + (s.max_players > 0 ? s.current_players / s.max_players : 0), 0) / sessions.length
        : 0;

      const badge = this.calculateHostBadge(sessionsHosted, completionRate);

      return {
        userId: hostId,
        sessionsHosted,
        completionRate,
        avgAttendance: Math.round(avgAttendance * 100),
        badge,
      };
    } catch (error) {
      console.error('Error fetching host stats:', error);
      return this.createDefaultHostStats(hostId);
    }
  }

  /**
   * Calculate host badge based on stats
   */
  static calculateHostBadge(sessionsHosted: number, completionRate: number): HostBadge {
    if (sessionsHosted >= 50 && completionRate >= 95) {
      return {
        type: 'superhost',
        label: '⭐ Superhost',
        color: '#F59E0B',
        sessionsHosted,
      };
    } else if (sessionsHosted >= 20 && completionRate >= 90) {
      return {
        type: 'veteran',
        label: '🏆 Veteran Host',
        color: '#8B5CF6',
        sessionsHosted,
      };
    } else if (sessionsHosted >= 5 && completionRate >= 80) {
      return {
        type: 'reliable',
        label: '✓ Reliable',
        color: '#22C55E',
        sessionsHosted,
      };
    } else {
      return {
        type: 'new',
        label: '🆕 New Host',
        color: '#3B82F6',
        sessionsHosted,
      };
    }
  }

  private static createDefaultHostStats(hostId: string): HostStats {
    return {
      userId: hostId,
      sessionsHosted: 0,
      completionRate: 100,
      avgAttendance: 0,
      badge: {
        type: 'new',
        label: '🆕 New Host',
        color: '#3B82F6',
        sessionsHosted: 0,
      },
    };
  }

  /**
   * Get mutual friends in a session
   */
  static async getMutualFriendsInSession(
    userId: string,
    sessionId: string
  ): Promise<{ count: number; names: string[] }> {
    try {
      // Get user's friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (!friendships || friendships.length === 0) {
        return { count: 0, names: [] };
      }

      const friendIds = friendships.map(f => 
        f.user_id === userId ? f.friend_id : f.user_id
      );

      // Get session participants
      const { data: participants } = await supabase
        .from('session_participants')
        .select(`
          user_id,
          users:user_id (full_name, email)
        `)
        .eq('session_id', sessionId)
        .eq('status', 'in')
        .in('user_id', friendIds);

      if (!participants) {
        return { count: 0, names: [] };
      }

      const names = participants.map(p => {
        const user = p.users as any;
        return user?.full_name || user?.email?.split('@')[0] || 'Friend';
      });

      return { count: participants.length, names };
    } catch (error) {
      console.error('Error fetching mutual friends:', error);
      return { count: 0, names: [] };
    }
  }
}

export default SocialProofService;
