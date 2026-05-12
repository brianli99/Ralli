import { supabase } from './supabase';

export type ConfidenceLevel = 'likely' | 'needs_players' | 'at_risk';

export interface SessionConfidence {
  level: ConfidenceLevel;
  score: number; // 0-100
  label: string;
  color: string;
  factors: ConfidenceFactor[];
}

interface ConfidenceFactor {
  name: string;
  value: number; // 0-1 contribution
  description: string;
}

export class SessionConfidenceService {
  /**
   * Calculate confidence score for a session.
   * Works with zero historical data (uses objective signals)
   * and gets smarter as data accumulates.
   */
  static async getConfidence(session: {
    id: string;
    creator_id: string;
    scheduled_for: string;
    max_players: number;
    current_players: number;
    status: string;
    sport: string;
    google_place_id?: string;
  }): Promise<SessionConfidence> {
    const factors: ConfidenceFactor[] = [];

    // Factor 1: Fill rate (always available, most important early on)
    const fillRate = session.max_players > 0
      ? session.current_players / session.max_players
      : 0;
    const fillScore = Math.min(fillRate * 1.2, 1); // Slight boost, cap at 1
    factors.push({
      name: 'fill_rate',
      value: fillScore,
      description: `${session.current_players}/${session.max_players} spots filled`,
    });

    // Factor 2: Time until session (sessions closer in time with players are more likely)
    const now = new Date();
    const sessionTime = new Date(session.scheduled_for);
    const hoursUntil = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    let timeScore = 0.5;
    if (hoursUntil <= 0) {
      timeScore = 0.3; // Already started/past
    } else if (hoursUntil <= 2) {
      timeScore = fillRate > 0.3 ? 0.9 : 0.4; // Imminent: high if filling, low if empty
    } else if (hoursUntil <= 6) {
      timeScore = fillRate > 0.2 ? 0.7 : 0.5;
    } else if (hoursUntil <= 24) {
      timeScore = 0.6;
    } else if (hoursUntil <= 72) {
      timeScore = 0.5;
    } else {
      timeScore = 0.4; // Far out, hard to predict
    }
    factors.push({
      name: 'time_proximity',
      value: timeScore,
      description: hoursUntil <= 1
        ? 'Starting soon'
        : hoursUntil <= 24
          ? 'Within 24 hours'
          : `${Math.round(hoursUntil / 24)} days away`,
    });

    // Factor 3: Host reliability (gets better with data)
    const hostScore = await this.getHostReliability(session.creator_id);
    factors.push({
      name: 'host_reliability',
      value: hostScore.score,
      description: hostScore.description,
    });

    const venueScore = await this.getVenuePopularity(
      session.sport,
      session.scheduled_for,
      session.google_place_id,
    );
    factors.push({
      name: 'venue_activity',
      value: venueScore.score,
      description: venueScore.description,
    });

    // Weighted composite score
    const weights = {
      fill_rate: 0.40,
      time_proximity: 0.25,
      host_reliability: 0.20,
      venue_activity: 0.15,
    };

    let compositeScore = 0;
    for (const factor of factors) {
      const weight = weights[factor.name as keyof typeof weights] || 0;
      compositeScore += factor.value * weight;
    }

    const score = Math.round(compositeScore * 100);
    const { level, label, color } = this.scoreToLevel(score);

    return { level, score, label, color, factors };
  }

  /**
   * Batch calculate confidence for multiple sessions (efficient)
   */
  static async getConfidenceBatch(sessions: Array<{
    id: string;
    creator_id: string;
    scheduled_for: string;
    max_players: number;
    current_players: number;
    status: string;
    sport: string;
    google_place_id?: string;
  }>): Promise<Map<string, SessionConfidence>> {
    const results = new Map<string, SessionConfidence>();

    const creatorIds = [...new Set(sessions.map(s => s.creator_id))];
    const hostScores = new Map<string, { score: number; description: string }>();
    await Promise.all(
      creatorIds.map(async (id) => {
        hostScores.set(id, await this.getHostReliability(id));
      })
    );

    // Pre-fetch venue scores for all unique sport+place+time combos
    const venueKeys = [...new Set(sessions.map(s => `${s.sport}|${s.scheduled_for}|${s.google_place_id || ''}`))];
    const venueScores = new Map<string, { score: number; description: string }>();
    await Promise.all(
      venueKeys.map(async (key) => {
        const [sport, scheduledFor, placeId] = key.split('|');
        venueScores.set(key, await this.getVenuePopularity(sport, scheduledFor, placeId || undefined));
      })
    );

    for (const session of sessions) {
      const factors: ConfidenceFactor[] = [];

      const fillRate = session.max_players > 0
        ? session.current_players / session.max_players
        : 0;
      factors.push({
        name: 'fill_rate',
        value: Math.min(fillRate * 1.2, 1),
        description: `${session.current_players}/${session.max_players} spots filled`,
      });

      const now = new Date();
      const hoursUntil = (new Date(session.scheduled_for).getTime() - now.getTime()) / (1000 * 60 * 60);
      let timeScore = 0.5;
      if (hoursUntil <= 0) timeScore = 0.3;
      else if (hoursUntil <= 2) timeScore = fillRate > 0.3 ? 0.9 : 0.4;
      else if (hoursUntil <= 6) timeScore = fillRate > 0.2 ? 0.7 : 0.5;
      else if (hoursUntil <= 24) timeScore = 0.6;
      else if (hoursUntil <= 72) timeScore = 0.5;
      else timeScore = 0.4;
      factors.push({
        name: 'time_proximity',
        value: timeScore,
        description: hoursUntil <= 1 ? 'Starting soon' : hoursUntil <= 24 ? 'Within 24 hours' : `${Math.round(hoursUntil / 24)} days away`,
      });

      const host = hostScores.get(session.creator_id) || { score: 0.5, description: 'New host' };
      factors.push({ name: 'host_reliability', value: host.score, description: host.description });

      const venueKey = `${session.sport}|${session.scheduled_for}|${session.google_place_id || ''}`;
      const venue = venueScores.get(venueKey) || { score: 0.5, description: 'Growing venue' };
      factors.push({ name: 'venue_activity', value: venue.score, description: venue.description });

      const weights = { fill_rate: 0.40, time_proximity: 0.25, host_reliability: 0.20, venue_activity: 0.15 };
      let compositeScore = 0;
      for (const factor of factors) {
        compositeScore += factor.value * (weights[factor.name as keyof typeof weights] || 0);
      }

      const score = Math.round(compositeScore * 100);
      const { level, label, color } = this.scoreToLevel(score);
      results.set(session.id, { level, score, label, color, factors });
    }

    return results;
  }

  private static async getHostReliability(hostId: string): Promise<{ score: number; description: string }> {
    try {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, status, current_players, max_players')
        .eq('creator_id', hostId)
        .in('status', ['completed', 'cancelled', 'upcoming', 'active']);

      if (!sessions || sessions.length === 0) {
        return { score: 0.5, description: 'New host' };
      }

      const total = sessions.length;
      const completed = sessions.filter(s => s.status === 'completed').length;
      const cancelled = sessions.filter(s => s.status === 'cancelled').length;
      const completionRate = total > 0 ? (total - cancelled) / total : 0.5;

      if (total >= 10 && completionRate >= 0.9) {
        return { score: 0.95, description: `Superhost · ${total} sessions, ${Math.round(completionRate * 100)}% completion` };
      } else if (total >= 5 && completionRate >= 0.8) {
        return { score: 0.8, description: `Reliable host · ${completed} completed` };
      } else if (total >= 2) {
        return { score: Math.max(0.4, completionRate * 0.8), description: `${completed}/${total} sessions completed` };
      }
      return { score: 0.5, description: 'New host' };
    } catch {
      return { score: 0.5, description: 'New host' };
    }
  }

  private static async getVenuePopularity(
    sport: string,
    scheduledFor: string,
    googlePlaceId?: string,
  ): Promise<{ score: number; description: string }> {
    try {
      const sessionDate = new Date(scheduledFor);
      const dayOfWeek = sessionDate.getDay();
      const hour = sessionDate.getHours();

      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      let query = supabase
        .from('check_ins')
        .select('created_at')
        .eq('sport', sport)
        .gte('created_at', fourWeeksAgo.toISOString());

      if (googlePlaceId) {
        query = query.eq('google_place_id', googlePlaceId);
      }

      const { data: checkIns } = await query;

      if (!checkIns || checkIns.length === 0) {
        return { score: 0.5, description: 'Growing venue' };
      }

      const relevantCheckIns = checkIns.filter(c => {
        const d = new Date(c.created_at);
        return d.getDay() === dayOfWeek && Math.abs(d.getHours() - hour) <= 2;
      });

      if (relevantCheckIns.length >= 10) {
        return { score: 0.85, description: 'Popular time slot' };
      } else if (relevantCheckIns.length >= 3) {
        return { score: 0.65, description: 'Active time slot' };
      }
      return { score: 0.5, description: 'Growing venue' };
    } catch {
      return { score: 0.5, description: 'Growing venue' };
    }
  }

  private static scoreToLevel(score: number): { level: ConfidenceLevel; label: string; color: string } {
    if (score >= 65) {
      return { level: 'likely', label: 'Likely to Run', color: '#22C55E' };
    } else if (score >= 40) {
      return { level: 'needs_players', label: 'Needs Players', color: '#F59E0B' };
    }
    return { level: 'at_risk', label: 'At Risk', color: '#EF4444' };
  }
}
