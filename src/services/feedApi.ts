// ============================================================================
// RALLI FEED API - SOCIAL ACTIVITY FEED INTEGRATION
// ============================================================================

import { supabase } from './supabase';
import { SportCode } from '../types/squad.types';

export interface FeedActivity {
  id: string;
  user_id: string;
  activity_type: 'game_completed' | 'squad_joined' | 'match_won' | 'achievement_unlocked' | 'check_in';
  activity_data: {
    sport?: SportCode;
    location?: string;
    facility_name?: string;
    details?: string;
    duration?: number;
    result?: 'victory' | 'defeat' | 'draw';
    squad_name?: string;
    achievement_type?: string;
  };
  related_match_id?: string;
  related_squad_id?: string;
  related_facility_id?: string;
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  
  // Joined data
  user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
  is_liked?: boolean;
}

export interface ActivityLike {
  id: string;
  activity_id: string;
  user_id: string;
  created_at: string;
}

export interface ActivityComment {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export class FeedApi {
  /**
   * Get activity feed for current user (shows friend activities)
   */
  static async getFeedActivities(limit = 20, before?: string): Promise<{ data: FeedActivity[] | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      let query = supabase
        .from('feed_activities')
        .select(`
          *,
          user:users!feed_activities_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Feed API error:', error);
        // Return empty array if table doesn't exist (development mode)
        if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
          return { data: [], error: null };
        }
        // If foreign key join fails, try fetching without join and then get user data separately
        if (error.message.includes('foreign key') || error.message.includes('relationship')) {
          return await this.getFeedActivitiesWithManualJoin(limit, before, user.id);
        }
        return { data: null, error: error.message };
      }

      const activityIds = (data || []).map(a => a.id);
      let likedActivityIds = new Set<string>();

      if (activityIds.length > 0) {
        const { data: userLikes } = await supabase
          .from('activity_likes')
          .select('activity_id')
          .eq('user_id', user.id)
          .in('activity_id', activityIds);

        likedActivityIds = new Set((userLikes || []).map(l => l.activity_id));
      }

      // Process the data - user data should already be joined
      const processedData: FeedActivity[] = (data || []).map(activity => ({
        ...activity,
        user: activity.user || {
          id: activity.user_id,
          full_name: 'Unknown User',
          avatar_url: null
        },
        is_liked: likedActivityIds.has(activity.id)
      }));

      return { data: processedData, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Fallback method when foreign key join doesn't work
   */
  private static async getFeedActivitiesWithManualJoin(limit: number, before: string | undefined, currentUserId: string): Promise<{ data: FeedActivity[] | null; error: string | null }> {
    try {
      let query = supabase
        .from('feed_activities')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error: error.message };
      }

      if (!data || data.length === 0) {
        return { data: [], error: null };
      }

      // Get unique user IDs
      const userIds = [...new Set(data.map(a => a.user_id))];

      // Fetch user data
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const usersMap = new Map((users || []).map(u => [u.id, u]));

      // Check likes
      const activityIds = data.map(a => a.id);
      const { data: userLikes } = await supabase
        .from('activity_likes')
        .select('activity_id')
        .eq('user_id', currentUserId)
        .in('activity_id', activityIds);

      const likedActivityIds = new Set((userLikes || []).map(l => l.activity_id));

      // Combine data
      const processedData: FeedActivity[] = data.map(activity => ({
        ...activity,
        user: usersMap.get(activity.user_id) || {
          id: activity.user_id,
          full_name: 'Unknown User',
          avatar_url: null
        },
        is_liked: likedActivityIds.has(activity.id)
      }));

      return { data: processedData, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Create a new activity (e.g., when user completes a game)
   */
  static async createActivity(activity: {
    activity_type: FeedActivity['activity_type'];
    activity_data: FeedActivity['activity_data'];
    related_match_id?: string;
    related_squad_id?: string;
    related_facility_id?: string;
    is_public?: boolean;
  }): Promise<{ data: FeedActivity | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('feed_activities')
        .insert([{
          user_id: user.id,
          ...activity,
          is_public: activity.is_public ?? true
        }])
        .select(`*`)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      // Fetch the user's profile data
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('id', user.id)
        .single();

      return { data: { 
        ...data, 
        user: userData || {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.avatar_url || null
        },
        is_liked: false 
      }, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Like/unlike an activity
   */
  static async toggleLike(activityId: string): Promise<{ data: boolean | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      // Check if already liked
      const { data: existingLike } = await supabase
        .from('activity_likes')
        .select('id')
        .eq('activity_id', activityId)
        .eq('user_id', user.id)
        .single();

      if (existingLike) {
        // Unlike
        const { error } = await supabase
          .from('activity_likes')
          .delete()
          .eq('activity_id', activityId)
          .eq('user_id', user.id);

        if (error) {
          return { data: null, error: error.message };
        }

        return { data: false, error: null };
      } else {
        // Like
        const { error } = await supabase
          .from('activity_likes')
          .insert([{
            activity_id: activityId,
            user_id: user.id
          }]);

        if (error) {
          return { data: null, error: error.message };
        }

        return { data: true, error: null };
      }
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Get comments for an activity
   */
  static async getActivityComments(activityId: string): Promise<{ data: ActivityComment[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('activity_comments')
        .select(`
          *,
          user:users!activity_comments_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Add a comment to an activity
   */
  static async addComment(activityId: string, content: string): Promise<{ data: ActivityComment | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('activity_comments')
        .insert([{
          activity_id: activityId,
          user_id: user.id,
          content: content
        }])
        .select(`
          *,
          user:users!activity_comments_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  /**
   * Subscribe to activity feed updates
   */
  static subscribeToFeedActivities(callback: (activity: FeedActivity) => void) {
    return supabase
      .channel('feed_activities')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'feed_activities',
        filter: 'is_public=eq.true'
      }, (payload) => {
        callback(payload.new as FeedActivity);
      })
      .subscribe();
  }

  /**
   * Subscribe to activity likes updates
   */
  static subscribeToActivityLikes(activityId: string, callback: (like: ActivityLike, event: 'INSERT' | 'DELETE') => void) {
    return supabase
      .channel(`activity_likes:${activityId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_likes',
        filter: `activity_id=eq.${activityId}`
      }, (payload) => {
        callback(payload.new as ActivityLike, 'INSERT');
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'activity_likes',
        filter: `activity_id=eq.${activityId}`
      }, (payload) => {
        callback(payload.old as ActivityLike, 'DELETE');
      })
      .subscribe();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const formatActivityText = (activity: FeedActivity): string => {
  const { activity_type, activity_data } = activity;
  const sport = activity_data.sport;
  const sportEmoji = sport ? getSportEmoji(sport) : '';

  switch (activity_type) {
    case 'game_completed':
      const result = activity_data.result;
      const resultText = result === 'victory' ? 'Victory!' : result === 'defeat' ? 'Good game!' : 'Game completed';
      return `completed a game ${sportEmoji} ${sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : ''}`;
    
    case 'squad_joined':
      return `joined a squad ${sportEmoji} ${sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : ''}`;
    
    case 'match_won':
      return `won a match ${sportEmoji} ${sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : ''}`;
    
    case 'achievement_unlocked':
      return `unlocked an achievement ${activity_data.achievement_type || ''}`;
    
    case 'check_in':
      return `checked in ${sportEmoji} ${sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : ''}`;
    
    default:
      return 'had an activity';
  }
};

export const formatActivityDetails = (activity: FeedActivity): string => {
  const { activity_data } = activity;
  
  if (activity.activity_type === 'game_completed') {
    const parts = [];
    if (activity_data.details) parts.push(activity_data.details);
    if (activity_data.duration) parts.push(`${activity_data.duration}m`);
    if (activity_data.result === 'victory') parts.push('Victory!');
    return parts.join(' • ');
  }
  
  if (activity.activity_type === 'squad_joined' && activity_data.squad_name) {
    return activity_data.squad_name;
  }
  
  return activity_data.details || '';
};

const getSportEmoji = (sport: SportCode): string => {
  const sportEmojis: Record<SportCode, string> = {
    basketball: '🏀',
    tennis: '🎾',
    pickleball: '🏓',
    volleyball: '🏐',
    soccer: '⚽',
    badminton: '🏸',
  };
  
  return sportEmojis[sport] || '🏀';
};
