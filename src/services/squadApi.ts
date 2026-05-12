// ============================================================================
// RALLI SQUAD API - SIMPLIFIED FOR DEMO
// ============================================================================

import { supabase } from './supabase';
import { 
  Squad, 
  SquadMember, 
  SquadWithMembers,
  Friendship, 
  FriendRequest,
  Match, 
  MatchWithDetails,
  MatchParticipant, 
  MatchInvitation,
  SquadMessage, 
  DirectThread, 
  DirectMessage,
  MessageThread,
  UserQRCode,
  CreateSquadRequest,
  UpdateSquadRequest,
  AddSquadMemberRequest,
  CreateMatchRequest,
  SendMessageRequest,
  ApiResponse,
  PaginatedResponse,
  SportCode,
  SquadRole,
  RSVPStatus,
  InvitationStatus
} from '../types/squad.types';

// ============================================================================
// SQUAD OPERATIONS
// ============================================================================

export class SquadApi {
  /**
   * Create a new squad and add creator as owner member
   */
  static async createSquad(request: CreateSquadRequest, ownerId: string): Promise<ApiResponse<Squad>> {
    try {
      // Step 1: Create the squad
      const { data: squadData, error: squadError } = await supabase
        .from('squads')
        .insert([{
          name: request.name,
          sport_code: request.sport_code,
          description: request.description,
          owner_id: ownerId,
          max_members: request.max_members || 12,
          is_private: request.is_private || false
        }])
        .select()
        .single();

      if (squadError) {
        console.error('Error creating squad:', squadError);
        return { data: null, error: squadError.message };
      }

      // Step 2: Add the creator as an owner member
      const { error: memberError } = await supabase
        .from('squad_members')
        .insert([{
          squad_id: squadData.id,
          user_id: ownerId,
          role: 'owner',
          joined_at: new Date().toISOString(),
          last_read_at: new Date().toISOString()
        }]);

      if (memberError) {
        console.error('Error adding owner as member:', memberError);
        // Squad was created but member wasn't added - try to clean up
        await supabase.from('squads').delete().eq('id', squadData.id);
        return { data: null, error: 'Failed to add you as squad owner' };
      }

      // Return the squad with user_role set
      return { 
        data: { ...squadData, user_role: 'owner' as SquadRole, member_count: 1 }, 
        error: null 
      };
    } catch (error) {
      console.error('Error in createSquad:', error);
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Get user's squads with their role in each
   */
  static async getMySquads(): Promise<ApiResponse<Squad[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('squad_members')
        .select(`
          role,
          squads (
            *
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (error) {
        console.error('Squad API error:', error);
        return { data: [], error: null };
      }

      // Extract squads from the nested structure and add user_role
      const squads: Squad[] = [];
      if (data) {
        for (const item of data) {
          const squadData = item.squads as unknown;
          if (squadData && typeof squadData === 'object') {
            // Add the user's role to the squad object
            squads.push({
              ...(squadData as Squad),
              user_role: item.role as SquadRole
            });
          }
        }
      }
      
      return { data: squads, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Get a squad by ID with members
   */
  static async getSquadById(squadId: string): Promise<ApiResponse<SquadWithMembers>> {
    try {
      // Get squad details
      const { data: squadData, error: squadError } = await supabase
        .from('squads')
        .select('*')
        .eq('id', squadId)
        .single();

      if (squadError) {
        console.error('Error fetching squad:', squadError);
        return { data: null, error: squadError.message };
      }

      // Get members with user details. Some older schemas don't have
      // position / jersey_number / last_read_at; if Postgres complains about
      // those columns we transparently retry with the minimal set.
      const fullSelect = `
          id,
          squad_id,
          user_id,
          role,
          position,
          jersey_number,
          joined_at,
          last_read_at,
          users:user_id (
            id,
            full_name,
            avatar_url,
            email
          )
        `;
      const minimalSelect = `
          id,
          squad_id,
          user_id,
          role,
          joined_at,
          users:user_id (
            id,
            full_name,
            avatar_url,
            email
          )
        `;

      const initial = await supabase
        .from('squad_members')
        .select(fullSelect)
        .eq('squad_id', squadId)
        .order('joined_at', { ascending: true });

      let membersData: any[] | null = initial.data as any[] | null;
      let membersError: any = initial.error;

      if (membersError && (membersError as any).code === '42703') {
        const fallback = await supabase
          .from('squad_members')
          .select(minimalSelect)
          .eq('squad_id', squadId)
          .order('joined_at', { ascending: true });
        membersData = fallback.data as any[] | null;
        membersError = fallback.error;
      }

      if (membersError) {
        console.error('Error fetching members:', membersError);
        return {
          data: { ...squadData, members: [] },
          error: null
        };
      }

      const members: SquadMember[] = (membersData || []).map((member: any) => ({
        id: member.id,
        squad_id: member.squad_id,
        user_id: member.user_id,
        role: member.role as SquadRole,
        position: member.position,
        jersey_number: member.jersey_number,
        joined_at: member.joined_at,
        last_read_at: member.last_read_at,
        user: member.users ? {
          id: (member.users as any).id,
          full_name: (member.users as any).full_name,
          avatar_url: (member.users as any).avatar_url,
          email: (member.users as any).email,
        } : undefined
      }));

      const ownerMember = members.find(m => m.role === 'owner');
      const owner = ownerMember?.user || {
        id: squadData.owner_id,
        full_name: undefined,
        avatar_url: undefined,
      };

      return { 
        data: { 
          ...squadData, 
          members,
          member_count: members.length,
          owner,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error in getSquadById:', error);
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Delete a squad
   */
  static async deleteSquad(squadId: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('squads')
        .delete()
        .eq('id', squadId);

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows affected is still success for delete
          return { data: true, error: null };
        }
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Update a squad member's role
   */
  static async updateMemberRole(squadId: string, memberId: string, newRole: SquadRole): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      // Verify the current user is owner or admin
      const { data: currentMember } = await supabase
        .from('squad_members')
        .select('role')
        .eq('squad_id', squadId)
        .eq('user_id', user.id)
        .single();

      if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
        return { data: null, error: 'You do not have permission to change roles' };
      }

      const { data: targetMember } = await supabase
        .from('squad_members')
        .select('role')
        .eq('id', memberId)
        .eq('squad_id', squadId)
        .single();

      if (!targetMember) {
        return { data: null, error: 'Member not found' };
      }

      if (targetMember.role === 'owner') {
        return { data: null, error: 'Cannot change the squad owner role' };
      }

      if (currentMember.role === 'admin' && targetMember.role !== 'member') {
        return { data: null, error: 'Admins can only manage regular members' };
      }

      // Cannot change owner role
      if (newRole === 'owner') {
        return { data: null, error: 'Cannot assign owner role directly' };
      }

      const { error } = await supabase
        .from('squad_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('squad_id', squadId);

      if (error) {
        console.error('Error updating member role:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Remove a member from a squad
   */
  static async removeMember(squadId: string, memberId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      // Verify the current user is owner or admin
      const { data: currentMember } = await supabase
        .from('squad_members')
        .select('role')
        .eq('squad_id', squadId)
        .eq('user_id', user.id)
        .single();

      if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
        return { data: null, error: 'You do not have permission to remove members' };
      }

      // Get the member being removed to check they're not the owner
      const { data: targetMember } = await supabase
        .from('squad_members')
        .select('role, user_id')
        .eq('id', memberId)
        .single();

      if (targetMember?.role === 'owner') {
        return { data: null, error: 'Cannot remove the squad owner' };
      }

      if (currentMember.role === 'admin' && targetMember?.role !== 'member') {
        return { data: null, error: 'Admins can only remove regular members' };
      }

      const { error } = await supabase
        .from('squad_members')
        .delete()
        .eq('id', memberId)
        .eq('squad_id', squadId);

      if (error) {
        console.error('Error removing member:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Leave a squad (remove yourself)
   */
  static async leaveSquad(squadId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      // Check if user is the owner
      const { data: membership } = await supabase
        .from('squad_members')
        .select('role')
        .eq('squad_id', squadId)
        .eq('user_id', user.id)
        .single();

      if (membership?.role === 'owner') {
        return { data: null, error: 'Owners cannot leave their squad. Transfer ownership or delete the squad instead.' };
      }

      const { error } = await supabase
        .from('squad_members')
        .delete()
        .eq('squad_id', squadId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error leaving squad:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Add a user to a squad
   */
  static async addMember(squadId: string, userId: string, role: SquadRole = 'member'): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      // Verify the current user can add members (owner or admin)
      const { data: currentMember } = await supabase
        .from('squad_members')
        .select('role')
        .eq('squad_id', squadId)
        .eq('user_id', user.id)
        .single();

      if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
        return { data: null, error: 'You do not have permission to add members' };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('squad_members')
        .select('id')
        .eq('squad_id', squadId)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        return { data: null, error: 'User is already a member of this squad' };
      }

      // Check squad member count
      const { data: squad } = await supabase
        .from('squads')
        .select('max_members')
        .eq('id', squadId)
        .single();

      const { count } = await supabase
        .from('squad_members')
        .select('*', { count: 'exact', head: true })
        .eq('squad_id', squadId);

      if (squad && squad.max_members && count !== null && count >= squad.max_members) {
        return { data: null, error: 'Squad is at maximum capacity' };
      }

      const { error } = await supabase
        .from('squad_members')
        .insert({
          squad_id: squadId,
          user_id: userId,
          role: role,
          joined_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error adding member:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Update squad details (name, description, privacy)
   */
  static async updateSquad(squadId: string, updates: UpdateSquadRequest): Promise<ApiResponse<Squad>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      // Verify user is owner
      const { data: membership } = await supabase
        .from('squad_members')
        .select('role')
        .eq('squad_id', squadId)
        .eq('user_id', user.id)
        .single();

      if (membership?.role !== 'owner') {
        return { data: null, error: 'Only the squad owner can edit squad settings' };
      }

      const { data, error } = await supabase
        .from('squads')
        .update({
          name: updates.name,
          description: updates.description,
          is_private: updates.is_private,
          max_members: updates.max_members,
          updated_at: new Date().toISOString(),
        })
        .eq('id', squadId)
        .select()
        .single();

      if (error) {
        console.error('Error updating squad:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Generate an invite code for the squad
   */
  static async generateInviteCode(squadId: string): Promise<ApiResponse<string>> {
    try {
      return { data: `ralli://squad/${squadId}`, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Search for public squads
   */
  static async searchSquads(query: string, sport?: string): Promise<ApiResponse<Squad[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userSquadIds: string[] = [];

      if (user) {
        const { data: memberships } = await supabase
          .from('squad_members')
          .select('squad_id')
          .eq('user_id', user.id);

        userSquadIds = memberships?.map(m => m.squad_id) || [];
      }

      let queryBuilder = supabase
        .from('squads')
        .select('*')
        .eq('is_private', false)
        .ilike('name', `%${query}%`)
        .limit(20);

      if (sport) {
        queryBuilder = queryBuilder.eq('sport_code', sport);
      }

      if (userSquadIds.length > 0) {
        queryBuilder = queryBuilder.not('id', 'in', `(${userSquadIds.join(',')})`);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error searching squads:', error);
        return { data: null, error: error.message };
      }

      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Get discoverable squads (public squads the user is not a member of)
   */
  static async getDiscoverableSquads(sport?: string, limit: number = 20): Promise<ApiResponse<Squad[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      // Get user's squad IDs
      const { data: memberships } = await supabase
        .from('squad_members')
        .select('squad_id')
        .eq('user_id', user.id);

      const userSquadIds = memberships?.map(m => m.squad_id) || [];

      let queryBuilder = supabase
        .from('squads')
        .select('*')
        .eq('is_private', false)
        .limit(limit);

      if (sport) {
        queryBuilder = queryBuilder.eq('sport_code', sport);
      }

      // Exclude squads user is already in
      if (userSquadIds.length > 0) {
        queryBuilder = queryBuilder.not('id', 'in', `(${userSquadIds.join(',')})`);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error fetching discoverable squads:', error);
        return { data: [], error: null };
      }

      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Request to join a squad
   */
  static async requestToJoin(squadId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      // Check if squad is public
      const { data: squad } = await supabase
        .from('squads')
        .select('is_private, max_members')
        .eq('id', squadId)
        .single();

      if (!squad) {
        return { data: null, error: 'Squad not found' };
      }

      const { data: existingMember } = await supabase
        .from('squad_members')
        .select('id')
        .eq('squad_id', squadId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        return { data: null, error: 'You are already a member of this squad' };
      }

      // Check current member count
      const { count } = await supabase
        .from('squad_members')
        .select('*', { count: 'exact', head: true })
        .eq('squad_id', squadId);

      if (squad.max_members && count !== null && count >= squad.max_members) {
        return { data: null, error: 'Squad is at maximum capacity' };
      }

      // For public squads, add directly as member
      // For private squads, you'd create a join request (future feature)
      if (!squad.is_private) {
        const { error } = await supabase
          .from('squad_members')
          .insert({
            squad_id: squadId,
            user_id: user.id,
            role: 'member',
            joined_at: new Date().toISOString(),
          });

        if (error) {
          if (error.code === '23505') { // Unique violation
            return { data: null, error: 'You are already a member of this squad' };
          }
          console.error('Error joining squad:', error);
          return { data: null, error: error.message };
        }

        return { data: true, error: null };
      } else {
        return { data: null, error: 'This squad is private. Request an invite from a member.' };
      }
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }
}

// ============================================================================
// FRIENDSHIP OPERATIONS
// ============================================================================

export class FriendshipApi {
  /**
   * Get all friends for the current user
   */
  static async getFriends(): Promise<ApiResponse<any[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('friendships')
        .select('user_id, friend_id, status, created_at')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error fetching friends:', error);
        return { data: [], error: null };
      }

      const friendIds = (data || []).map(f => (f.user_id === user.id ? f.friend_id : f.user_id));
      if (friendIds.length === 0) {
        return { data: [], error: null };
      }

      const { data: profiles, error: profileErr } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, preferred_sports')
        .in('id', friendIds);

      if (profileErr) {
        console.error('Error fetching friend profiles:', profileErr);
        return { data: [], error: null };
      }

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const friends = friendIds.map(fid => {
        const profile = profileMap.get(fid) || { id: fid };
        return {
          ...profile,
          id: fid,
          friendship_id: fid,
          status: 'friend' as const,
        };
      });

      return { data: friends, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Get pending friend requests received by the current user
   */
  static async getFriendRequests(): Promise<ApiResponse<any[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('friendships')
        .select('user_id, friend_id, status, created_at')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching friend requests:', error);
        return { data: [], error: null };
      }

      const senderIds = (data || []).map(req => req.user_id);
      let senderMap = new Map<string, any>();
      if (senderIds.length > 0) {
        const { data: senders, error: senderErr } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, preferred_sports')
          .in('id', senderIds);
        if (senderErr) {
          console.error('Error fetching request senders:', senderErr);
        } else {
          senderMap = new Map((senders || []).map(s => [s.id, s]));
        }
      }

      const requests = (data || []).map(req => ({
        id: req.user_id,
        sender_id: req.user_id,
        receiver_id: req.friend_id,
        status: req.status,
        created_at: req.created_at,
        sender: senderMap.get(req.user_id) || { id: req.user_id },
        from_user: senderMap.get(req.user_id) || { id: req.user_id },
      }));

      return { data: requests, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Send a friend request
   */
  static async sendFriendRequest(friendId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data: existing } = await supabase
        .from('friendships')
        .select('user_id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
        .single();

      if (existing) {
        if (existing.status === 'accepted') {
          return { data: null, error: 'Already friends' };
        }
        return { data: null, error: 'Friend request already sent' };
      }

      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'pending',
        });

      if (error) {
        console.error('Error sending friend request:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Accept a friend request
   */
  static async acceptFriendRequest(senderId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('user_id', senderId)
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error accepting friend request:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Decline/reject a friend request
   */
  static async declineFriendRequest(senderId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', senderId)
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error declining friend request:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Remove a friend
   */
  static async removeFriend(friendUserId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${user.id})`);

      if (error) {
        console.error('Error removing friend:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Block a user and remove any existing friendship/request state.
   */
  static async blockUser(blockedUserId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${blockedUserId}),and(user_id.eq.${blockedUserId},friend_id.eq.${user.id})`);

      if (deleteError) {
        console.error('Error clearing friendship before block:', deleteError);
        return { data: null, error: deleteError.message };
      }

      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: blockedUserId,
          status: 'blocked',
        });

      if (error) {
        console.error('Error blocking user:', error);
        return { data: null, error: error.message };
      }

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Search users by display name without exposing email addresses in results
   */
  static async searchUsers(query: string): Promise<ApiResponse<any[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const searchTerm = `%${query}%`;

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, preferred_sports')
        .ilike('full_name', searchTerm)
        .neq('id', user.id)
        .limit(20);

      if (error) {
        console.error('Error searching users:', error);
        return { data: [], error: null };
      }

      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }
}

// ============================================================================
// QR CODE OPERATIONS
// ============================================================================

export class QRCodeApi {
  // Simplified for demo - methods not implemented
}

// ============================================================================
// MESSAGING OPERATIONS
// ============================================================================

export class MessagingApi {
  /**
   * Find or create a direct message thread between the current user and another user.
   */
  static async getOrCreateDirectThreadId(otherUserId: string): Promise<ApiResponse<string>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const [smallerId, largerId] = [user.id, otherUserId].sort();
      const threadQuery = () => supabase
        .from('direct_threads')
        .select('id')
        .eq('user_a', smallerId)
        .eq('user_b', largerId)
        .maybeSingle();

      let { data: thread, error: threadLookupError } = await threadQuery();
      if (threadLookupError) {
        return { data: null, error: threadLookupError.message };
      }

      if (!thread) {
        const { data: newThread, error: threadError } = await supabase
          .from('direct_threads')
          .insert({
            user_a: smallerId,
            user_b: largerId,
          })
          .select('id')
          .single();

        if (threadError) {
          if (threadError.code === '23505') {
            const retry = await threadQuery();
            thread = retry.data;
            threadLookupError = retry.error;
            if (threadLookupError) return { data: null, error: threadLookupError.message };
          } else {
            console.error('Error creating thread:', threadError);
            return { data: null, error: threadError.message };
          }
        } else {
          thread = newThread;
        }
      }

      return { data: thread?.id || null, error: thread?.id ? null : 'Could not create chat thread' };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Get messages for a squad chat
   */
  static async getSquadMessages(squadId: string, limit: number = 50): Promise<ApiResponse<any[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('squad_messages')
        .select('id, squad_id, sender_id, content, message_type, created_at')
        .eq('squad_id', squadId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching squad messages:', error);
        return { data: [], error: null };
      }

      const senderIds = Array.from(new Set((data || []).map(m => m.sender_id))).filter(Boolean);
      let senderMap = new Map<string, any>();
      if (senderIds.length > 0) {
        const { data: senders, error: senderErr } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);
        if (senderErr) {
          console.error('Error fetching message senders:', senderErr);
        } else {
          senderMap = new Map((senders || []).map(s => [s.id, s]));
        }
      }

      const messages = (data || []).map(msg => {
        const senderData = senderMap.get(msg.sender_id);
        return {
          id: msg.id,
          content: msg.content,
          sender_id: msg.sender_id,
          sender_name: senderData?.full_name || 'Unknown',
          sender_avatar: senderData?.avatar_url,
          created_at: msg.created_at,
          message_type: msg.message_type || 'text',
          is_own_message: msg.sender_id === user.id,
        };
      });

      return { data: messages, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Send a message to a squad
   */
  static async sendSquadMessage(squadId: string, content: string): Promise<ApiResponse<any>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('squad_messages')
        .insert({
          squad_id: squadId,
          sender_id: user.id,
          content: content.trim(),
          message_type: 'text',
        })
        .select(`
          id,
          squad_id,
          sender_id,
          content,
          message_type,
          created_at
        `)
        .single();

      if (error) {
        console.error('Error sending squad message:', error);
        return { data: null, error: error.message };
      }

      return { 
        data: {
          ...data,
          sender_name: user.user_metadata?.full_name || 'You',
          sender_avatar: user.user_metadata?.avatar_url,
          is_own_message: true,
        }, 
        error: null 
      };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Get direct messages between two users
   */
  static async getDirectMessages(otherUserId: string, limit: number = 50): Promise<ApiResponse<any[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data: threadId, error: threadError } = await this.getOrCreateDirectThreadId(otherUserId);
      if (threadError || !threadId) return { data: null, error: threadError || 'Could not create chat thread' };

      const { data, error } = await supabase
        .from('direct_messages')
        .select('id, thread_id, sender_id, content, message_type, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching direct messages:', error);
        return { data: [], error: null };
      }

      const senderIds = Array.from(new Set((data || []).map(m => m.sender_id))).filter(Boolean);
      let senderMap = new Map<string, any>();
      if (senderIds.length > 0) {
        const { data: senders, error: senderErr } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);
        if (senderErr) {
          console.error('Error fetching DM senders:', senderErr);
        } else {
          senderMap = new Map((senders || []).map(s => [s.id, s]));
        }
      }

      const messages = (data || []).map(msg => {
        const senderData = senderMap.get(msg.sender_id);
        return {
          id: msg.id,
          content: msg.content,
          sender_id: msg.sender_id,
          sender_name: senderData?.full_name || 'Unknown',
          sender_avatar: senderData?.avatar_url,
          created_at: msg.created_at,
          message_type: msg.message_type || 'text',
          is_own_message: msg.sender_id === user.id,
        };
      });

      return { data: messages, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Send a direct message to another user
   */
  static async sendDirectMessage(otherUserId: string, content: string): Promise<ApiResponse<any>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data: threadId, error: threadError } = await this.getOrCreateDirectThreadId(otherUserId);
      if (threadError || !threadId) return { data: null, error: threadError || 'Could not create chat thread' };

      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          content: content.trim(),
          message_type: 'text',
        })
        .select('id, thread_id, sender_id, content, message_type, created_at')
        .single();

      if (error) {
        console.error('Error sending direct message:', error);
        return { data: null, error: error.message };
      }

      return { 
        data: {
          ...data,
          sender_name: user.user_metadata?.full_name || 'You',
          sender_avatar: user.user_metadata?.avatar_url,
          is_own_message: true,
        }, 
        error: null 
      };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Subscribe to real-time squad messages
   */
  static subscribeToSquadMessages(squadId: string, onMessage: (message: any) => void) {
    return supabase
      .channel(`squad-messages-${squadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'squad_messages',
          filter: `squad_id=eq.${squadId}`,
        },
        (payload) => {
          onMessage(payload.new);
        }
      )
      .subscribe();
  }

  /**
   * Subscribe to real-time direct messages
   */
  static subscribeToDirectMessages(threadId: string, onMessage: (message: any) => void) {
    return supabase
      .channel(`direct-messages-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          onMessage(payload.new);
        }
      )
      .subscribe();
  }
}

// ============================================================================
// COMBINED API EXPORT
// ============================================================================

export const squadApi = {
  squads: SquadApi,
  friends: FriendshipApi,
  qr: QRCodeApi,
  messages: MessagingApi
};
