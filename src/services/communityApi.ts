// ============================================================================
// RALLI COMMUNITY API - Court Chat, Crews, Challenges
// ============================================================================

import { supabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface CourtMessage {
  id: string;
  google_place_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'image' | 'session_link' | 'crew_announcement' | 'challenge';
  metadata: Record<string, any>;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

export interface Crew {
  id: string;
  name: string;
  google_place_id: string;
  sport: string;
  description: string | null;
  avatar_url: string | null;
  captain_id: string;
  wins: number;
  losses: number;
  draws: number;
  is_open: boolean;
  max_members: number;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_member?: boolean;
}

export interface CrewMember {
  crew_id: string;
  user_id: string;
  role: 'captain' | 'co-captain' | 'member';
  joined_at: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
}

export interface CrewChallenge {
  id: string;
  challenger_crew_id: string;
  challenged_crew_id: string;
  google_place_id: string;
  sport: string;
  proposed_time: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  session_id: string | null;
  winner_crew_id: string | null;
  challenger_score: number | null;
  challenged_score: number | null;
  created_at: string;
  updated_at: string;
  challenger_crew?: Crew;
  challenged_crew?: Crew;
}

// ============================================================================
// COURT CHAT
// ============================================================================

export class CommunityApi {
  private static async getCurrentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  }

  private static async getCrewRole(crewId: string, userId: string): Promise<CrewMember['role'] | null> {
    const { data, error } = await supabase
      .from('crew_members')
      .select('role')
      .eq('crew_id', crewId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking crew role:', error);
      return null;
    }

    return (data?.role as CrewMember['role']) || null;
  }

  private static canManageCrew(role: CrewMember['role'] | null): boolean {
    return role === 'captain' || role === 'co-captain';
  }

  /**
   * Fetch messages for a court/facility
   */
  static async getCourtMessages(
    googlePlaceId: string,
    limit = 50,
    before?: string
  ): Promise<CourtMessage[]> {
    try {
      let query = supabase
        .from('court_messages')
        .select('*')
        .eq('google_place_id', googlePlaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const userMap = new Map(
        (users || []).map((u: any) => [u.id, { name: u.full_name, avatar: u.avatar_url }])
      );

      return data.map((msg: any) => ({
        ...msg,
        user_name: userMap.get(msg.user_id)?.name || 'Unknown',
        user_avatar: userMap.get(msg.user_id)?.avatar || undefined,
      }));
    } catch (error) {
      console.error('Error fetching court messages:', error);
      return [];
    }
  }

  /**
   * Send a message to a court chat
   */
  static async sendCourtMessage(
    googlePlaceId: string,
    userId: string,
    content: string,
    messageType: CourtMessage['message_type'] = 'text',
    metadata: Record<string, any> = {}
  ): Promise<CourtMessage | null> {
    try {
      const { data, error } = await supabase
        .from('court_messages')
        .insert({
          google_place_id: googlePlaceId,
          user_id: userId,
          content,
          message_type: messageType,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CourtMessage;
    } catch (error) {
      console.error('Error sending court message:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time court messages
   */
  static subscribeToCourtMessages(
    googlePlaceId: string,
    onMessage: (msg: CourtMessage) => void
  ) {
    return supabase
      .channel(`court-chat-${googlePlaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_messages',
          filter: `google_place_id=eq.${googlePlaceId}`,
        },
        async (payload) => {
          try {
            const msg = payload.new as CourtMessage;
            const { data: userData } = await supabase
              .from('users')
              .select('full_name, avatar_url')
              .eq('id', msg.user_id)
              .single();

            onMessage({
              ...msg,
              user_name: userData?.full_name || 'Unknown',
              user_avatar: userData?.avatar_url || undefined,
            });
          } catch (err) {
            console.error('Error in court message subscription:', err);
          }
        }
      )
      .subscribe();
  }

  // ============================================================================
  // CREWS
  // ============================================================================

  /**
   * Get crews at a specific court/facility
   */
  static async getCrewsAtCourt(
    googlePlaceId: string,
    userId?: string
  ): Promise<Crew[]> {
    try {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('google_place_id', googlePlaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      const crewIds = data.map((c: any) => c.id);
      const { data: members } = await supabase
        .from('crew_members')
        .select('crew_id, user_id')
        .in('crew_id', crewIds);

      return data.map((crew: any) => {
        const crewMembers = (members || []).filter((m: any) => m.crew_id === crew.id);
        return {
          ...crew,
          member_count: crewMembers.length,
          is_member: userId ? crewMembers.some((m: any) => m.user_id === userId) : false,
        };
      });
    } catch (error) {
      console.error('Error fetching crews:', error);
      return [];
    }
  }

  /**
   * Get all crews a user is a member of
   */
  static async getUserCrews(userId: string): Promise<Crew[]> {
    try {
      const { data: memberships, error: memberError } = await supabase
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', userId);

      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) return [];

      const crewIds = memberships.map((m: any) => m.crew_id);
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .in('id', crewIds);

      if (error) throw error;

      const { data: allMembers } = await supabase
        .from('crew_members')
        .select('crew_id, user_id')
        .in('crew_id', crewIds);

      return (data || []).map((crew: any) => ({
        ...crew,
        member_count: (allMembers || []).filter((m: any) => m.crew_id === crew.id).length,
        is_member: true,
      }));
    } catch (error) {
      console.error('Error fetching user crews:', error);
      return [];
    }
  }

  /**
   * Get a single crew with full details
   */
  static async getCrewById(crewId: string): Promise<{ crew: Crew; members: CrewMember[] } | null> {
    try {
      const { data: crew, error } = await supabase
        .from('crews')
        .select('*')
        .eq('id', crewId)
        .single();

      if (error) throw error;

      const { data: members } = await supabase
        .from('crew_members')
        .select('*')
        .eq('crew_id', crewId)
        .order('joined_at', { ascending: true });

      const userIds = (members || []).map((m: any) => m.user_id);
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, email')
        .in('id', userIds);

      const userMap = new Map(
        (users || []).map((u: any) => [u.id, u])
      );

      const enrichedMembers: CrewMember[] = (members || []).map((m: any) => ({
        ...m,
        full_name: userMap.get(m.user_id)?.full_name || 'Unknown',
        avatar_url: userMap.get(m.user_id)?.avatar_url || undefined,
        email: userMap.get(m.user_id)?.email || undefined,
      }));

      const memberCount = enrichedMembers.length;

      return {
        crew: { ...crew, member_count: memberCount } as Crew,
        members: enrichedMembers,
      };
    } catch (error) {
      console.error('Error fetching crew:', error);
      return null;
    }
  }

  /**
   * Create a new crew
   */
  static async createCrew(params: {
    name: string;
    googlePlaceId: string;
    sport: string;
    description?: string;
    captainId: string;
    maxMembers?: number;
  }): Promise<Crew | null> {
    try {
      const { data: crew, error } = await supabase
        .from('crews')
        .insert({
          name: params.name,
          google_place_id: params.googlePlaceId,
          sport: params.sport,
          description: params.description || null,
          captain_id: params.captainId,
          max_members: params.maxMembers || 15,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: memberErr } = await supabase.from('crew_members').insert({
        crew_id: crew.id,
        user_id: params.captainId,
        role: 'captain',
      });

      if (memberErr) {
        console.error('Failed to add captain as member, cleaning up:', memberErr);
        await supabase.from('crews').delete().eq('id', crew.id);
        return null;
      }

      return crew as Crew;
    } catch (error) {
      console.error('Error creating crew:', error);
      return null;
    }
  }

  /**
   * Join a crew
   */
  static async joinCrew(crewId: string, userId: string): Promise<boolean> {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId || currentUserId !== userId) return false;

      const { data: crew, error: crewError } = await supabase
        .from('crews')
        .select('is_open, max_members')
        .eq('id', crewId)
        .single();

      if (crewError || !crew?.is_open) return false;

      const { count } = await supabase
        .from('crew_members')
        .select('crew_id', { count: 'exact', head: true })
        .eq('crew_id', crewId);

      if (crew.max_members && count !== null && count >= crew.max_members) return false;

      const { error } = await supabase.from('crew_members').insert({
        crew_id: crewId,
        user_id: userId,
        role: 'member',
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error joining crew:', error);
      return false;
    }
  }

  /**
   * Leave a crew
   */
  static async leaveCrew(crewId: string, userId: string): Promise<boolean> {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId || currentUserId !== userId) return false;

      const role = await this.getCrewRole(crewId, userId);
      if (role === 'captain') return false;

      const { error } = await supabase
        .from('crew_members')
        .delete()
        .eq('crew_id', crewId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error leaving crew:', error);
      return false;
    }
  }

  /**
   * Update crew details (captain only)
   */
  static async updateCrew(
    crewId: string,
    updates: Partial<Pick<Crew, 'name' | 'description' | 'is_open' | 'max_members'>>
  ): Promise<boolean> {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return false;

      const role = await this.getCrewRole(crewId, currentUserId);
      if (!this.canManageCrew(role)) return false;

      const { error } = await supabase
        .from('crews')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', crewId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating crew:', error);
      return false;
    }
  }

  // ============================================================================
  // CHALLENGES
  // ============================================================================

  /**
   * Get challenges for a crew
   */
  static async getCrewChallenges(crewId: string): Promise<CrewChallenge[]> {
    try {
      const { data, error } = await supabase
        .from('crew_challenges')
        .select('*')
        .or(`challenger_crew_id.eq.${crewId},challenged_crew_id.eq.${crewId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      const crewIds = [
        ...new Set(data.flatMap((c: any) => [c.challenger_crew_id, c.challenged_crew_id]))
      ];

      const { data: crews } = await supabase
        .from('crews')
        .select('*')
        .in('id', crewIds);

      const crewMap = new Map((crews || []).map((c: any) => [c.id, c]));

      return data.map((challenge: any) => ({
        ...challenge,
        challenger_crew: crewMap.get(challenge.challenger_crew_id) || undefined,
        challenged_crew: crewMap.get(challenge.challenged_crew_id) || undefined,
      }));
    } catch (error) {
      console.error('Error fetching challenges:', error);
      return [];
    }
  }

  /**
   * Get challenges at a court
   */
  static async getChallengesAtCourt(googlePlaceId: string): Promise<CrewChallenge[]> {
    try {
      const { data, error } = await supabase
        .from('crew_challenges')
        .select('*')
        .eq('google_place_id', googlePlaceId)
        .in('status', ['pending', 'accepted'])
        .order('proposed_time', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      const crewIds = [
        ...new Set(data.flatMap((c: any) => [c.challenger_crew_id, c.challenged_crew_id]))
      ];

      const { data: crews } = await supabase
        .from('crews')
        .select('*')
        .in('id', crewIds);

      const crewMap = new Map((crews || []).map((c: any) => [c.id, c]));

      return data.map((challenge: any) => ({
        ...challenge,
        challenger_crew: crewMap.get(challenge.challenger_crew_id) || undefined,
        challenged_crew: crewMap.get(challenge.challenged_crew_id) || undefined,
      }));
    } catch (error) {
      console.error('Error fetching court challenges:', error);
      return [];
    }
  }

  /**
   * Create a challenge
   */
  static async createChallenge(params: {
    challengerCrewId: string;
    challengedCrewId: string;
    googlePlaceId: string;
    sport: string;
    proposedTime: string;
    message?: string;
  }): Promise<CrewChallenge | null> {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return null;

      const role = await this.getCrewRole(params.challengerCrewId, currentUserId);
      if (!this.canManageCrew(role)) return null;

      const { data: crews, error: crewError } = await supabase
        .from('crews')
        .select('id, google_place_id, sport')
        .in('id', [params.challengerCrewId, params.challengedCrewId]);

      if (crewError || !crews || crews.length !== 2) return null;

      const challenger = crews.find((crew: any) => crew.id === params.challengerCrewId);
      const challenged = crews.find((crew: any) => crew.id === params.challengedCrewId);
      if (
        !challenger ||
        !challenged ||
        challenger.google_place_id !== params.googlePlaceId ||
        challenged.google_place_id !== params.googlePlaceId ||
        challenger.sport !== params.sport ||
        challenged.sport !== params.sport
      ) {
        return null;
      }

      const { data, error } = await supabase
        .from('crew_challenges')
        .insert({
          challenger_crew_id: params.challengerCrewId,
          challenged_crew_id: params.challengedCrewId,
          google_place_id: params.googlePlaceId,
          sport: params.sport,
          proposed_time: params.proposedTime,
          message: params.message || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CrewChallenge;
    } catch (error) {
      console.error('Error creating challenge:', error);
      return null;
    }
  }

  /**
   * Respond to a challenge (accept/decline)
   */
  static async respondToChallenge(
    challengeId: string,
    status: 'accepted' | 'declined'
  ): Promise<boolean> {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return false;

      const { data: challenge, error: challengeError } = await supabase
        .from('crew_challenges')
        .select('challenged_crew_id, status')
        .eq('id', challengeId)
        .single();

      if (challengeError || !challenge || challenge.status !== 'pending') return false;

      const role = await this.getCrewRole(challenge.challenged_crew_id, currentUserId);
      if (!this.canManageCrew(role)) return false;

      const { error } = await supabase
        .from('crew_challenges')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', challengeId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error responding to challenge:', error);
      return false;
    }
  }

  /**
   * Record challenge result
   */
  static async recordChallengeResult(
    challengeId: string,
    winnerCrewId: string,
    challengerScore: number,
    challengedScore: number
  ): Promise<boolean> {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return false;

      const { data: challenge, error: fetchError } = await supabase
        .from('crew_challenges')
        .select('challenger_crew_id, challenged_crew_id, status')
        .eq('id', challengeId)
        .single();

      if (fetchError || !challenge || challenge.status !== 'accepted') return false;

      if (
        winnerCrewId !== challenge.challenger_crew_id &&
        winnerCrewId !== challenge.challenged_crew_id
      ) {
        return false;
      }

      const challengerRole = await this.getCrewRole(challenge.challenger_crew_id, currentUserId);
      const challengedRole = await this.getCrewRole(challenge.challenged_crew_id, currentUserId);
      if (!this.canManageCrew(challengerRole) && !this.canManageCrew(challengedRole)) return false;

      const { error } = await supabase
        .from('crew_challenges')
        .update({
          status: 'completed',
          winner_crew_id: winnerCrewId,
          challenger_score: challengerScore,
          challenged_score: challengedScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', challengeId);

      if (error) throw error;

      const loserCrewId = winnerCrewId === challenge.challenger_crew_id
        ? challenge.challenged_crew_id
        : challenge.challenger_crew_id;

      const { error: winErr } = await supabase.rpc('increment_crew_wins', { crew_id_param: winnerCrewId });
      if (winErr) console.error('Failed to increment wins:', winErr);

      const { error: lossErr } = await supabase.rpc('increment_crew_losses', { crew_id_param: loserCrewId });
      if (lossErr) console.error('Failed to increment losses:', lossErr);

      return true;
    } catch (error) {
      console.error('Error recording result:', error);
      return false;
    }
  }
}
