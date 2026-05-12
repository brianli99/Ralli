import { supabase } from './supabase';
import { SportCode } from '../types/squad.types';

export interface PredictionResult {
  timeSlot: string; // "14:00"
  predictedLevel: 'low' | 'medium' | 'high' | 'full';
  confidenceScore: number; // 0-1
  reason: string;
}

export interface FacilityRecommendation {
  facilityId: string;
  score: number; // 0-100
  matchReasons: string[];
  bestTime?: string;
}

export class AIPredictionService {
  
  /**
   * Predicts how busy a facility will be at a specific time in the future.
   * Uses historical check-in data averaged by day-of-week and hour.
   */
  static async predictFacilityCapacity(
    facilityId: string, 
    targetDate: Date
  ): Promise<PredictionResult> {
    try {
      const dayOfWeek = targetDate.getDay(); // 0-6
      const hour = targetDate.getHours(); // 0-23
      
      // 1. Fetch historical data for this facility, day, and hour window
      // Note: This is a simplified query. In production, you'd want a dedicated
      // materialized view or edge function to aggregate this data efficiently.
      const { data: history, error } = await supabase
        .from('check_ins')
        .select('created_at')
        .eq('google_place_id', facilityId);

      if (error || !history) {
        return {
          timeSlot: `${hour.toString().padStart(2, '0')}:00`,
          predictedLevel: 'low',
          confidenceScore: 0.1,
          reason: 'Insufficient historical data'
        };
      }

      // 2. Filter and Analyze locally (MVP approach)
      // In a real AI system, this logic lives in a Python backend or Edge Function
      const relevantCheckIns = history.filter(checkIn => {
        const checkInDate = new Date(checkIn.created_at);
        return checkInDate.getDay() === dayOfWeek && 
               Math.abs(checkInDate.getHours() - hour) <= 1; // +/- 1 hour window
      });

      // Calculate average occupancy
      // Assuming we have 4 weeks of data, divide count by 4
      const averageOccupancy = relevantCheckIns.length / 4; 

      let level: 'low' | 'medium' | 'high' | 'full' = 'low';
      if (averageOccupancy > 20) level = 'full';
      else if (averageOccupancy > 10) level = 'high';
      else if (averageOccupancy > 5) level = 'medium';

      return {
        timeSlot: `${hour}:00`,
        predictedLevel: level,
        confidenceScore: Math.min(0.9, relevantCheckIns.length * 0.1), // More data = higher confidence
        reason: level === 'low' ? 'Usually quiet at this time' : 'Typically busy on this day'
      };

    } catch (err) {
      console.error('Prediction error:', err);
      return {
        timeSlot: '00:00',
        predictedLevel: 'low',
        confidenceScore: 0,
        reason: 'Error calculating prediction'
      };
    }
  }

  /**
   * Finds the best time to play for a specific facility and sport
   * Analyzes historical check-in data to find times with lower activity
   */
  static async getBestTimeToPlay(
    facilityId: string,
    sport?: SportCode
  ): Promise<{ time: string; level: string; reason: string }[]> {
    try {
      // Get the current day of week
      const today = new Date();
      const dayOfWeek = today.getDay();
      
      // Fetch check-ins for this facility from the past 4 weeks
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      
      let query = supabase
        .from('check_ins')
        .select('created_at, sport')
        .eq('google_place_id', facilityId)
        .gte('created_at', fourWeeksAgo.toISOString());
      
      // If sport is specified, filter by it
      if (sport) {
        query = query.eq('sport', sport);
      }
      
      const { data: checkIns, error } = await query;
      
      if (error || !checkIns || checkIns.length === 0) {
        // Return default recommendations if no data
        return [
          { time: '09:00', level: 'low', reason: 'Morning hours are typically less busy' },
          { time: '14:00', level: 'medium', reason: 'Afternoon sweet spot between lunch and evening rush' },
          { time: '20:00', level: 'low', reason: 'Later evening tends to be quieter' },
        ];
      }
      
      // Analyze check-ins by hour for the same day of week
      const hourCounts: Record<number, number> = {};
      const totalWeeks = 4;
      
      // Initialize all hours
      for (let h = 6; h <= 22; h++) {
        hourCounts[h] = 0;
      }
      
      // Count check-ins by hour for matching days
      checkIns.forEach(checkIn => {
        const checkInDate = new Date(checkIn.created_at);
        if (checkInDate.getDay() === dayOfWeek) {
          const hour = checkInDate.getHours();
          if (hour >= 6 && hour <= 22) {
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          }
        }
      });
      
      // Calculate average and find quiet hours
      const hourData = Object.entries(hourCounts).map(([hour, count]) => ({
        hour: parseInt(hour),
        avgCount: count / totalWeeks,
      }));
      
      // Sort by average count (ascending - quietest first)
      hourData.sort((a, b) => a.avgCount - b.avgCount);
      
      // Get the 3 best times (quietest hours)
      const bestTimes = hourData.slice(0, 3).map(({ hour, avgCount }) => {
        let level = 'low';
        let reason = 'Usually quiet at this time';
        
        if (avgCount > 10) {
          level = 'high';
          reason = 'Can get busy, but good for finding games';
        } else if (avgCount > 5) {
          level = 'medium';
          reason = 'Moderate activity - good balance';
        }
        
        return {
          time: `${hour.toString().padStart(2, '0')}:00`,
          level,
          reason,
        };
      });
      
      return bestTimes;
      
    } catch (err) {
      console.error('Error getting best time to play:', err);
      return [
        { time: '09:00', level: 'low', reason: 'Morning hours are typically less busy' },
        { time: '14:00', level: 'medium', reason: 'Afternoon sweet spot' },
        { time: '20:00', level: 'low', reason: 'Evening tends to be quieter' },
      ];
    }
  }
  
  /**
   * Get hourly activity breakdown for a facility
   */
  static async getHourlyActivityBreakdown(
    facilityId: string,
    sport?: SportCode
  ): Promise<{ hour: string; level: 'low' | 'medium' | 'high' | 'peak'; count: number }[]> {
    try {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const today = new Date();
      const dayOfWeek = today.getDay();
      
      let query = supabase
        .from('check_ins')
        .select('created_at')
        .eq('google_place_id', facilityId)
        .gte('created_at', fourWeeksAgo.toISOString());
      
      if (sport) {
        query = query.eq('sport', sport);
      }
      
      const { data: checkIns, error } = await query;
      
      // Initialize hourly breakdown
      const breakdown: { hour: string; level: 'low' | 'medium' | 'high' | 'peak'; count: number }[] = [];
      
      for (let h = 6; h <= 22; h++) {
        const hourCheckIns = (checkIns || []).filter(c => {
          const date = new Date(c.created_at);
          return date.getDay() === dayOfWeek && date.getHours() === h;
        });
        
        const count = hourCheckIns.length / 4; // Average over 4 weeks
        let level: 'low' | 'medium' | 'high' | 'peak' = 'low';
        
        if (count > 15) level = 'peak';
        else if (count > 10) level = 'high';
        else if (count > 5) level = 'medium';
        
        breakdown.push({
          hour: `${h.toString().padStart(2, '0')}:00`,
          level,
          count: Math.round(count),
        });
      }
      
      return breakdown;
    } catch (err) {
      console.error('Error getting hourly breakdown:', err);
      return [];
    }
  }

  /**
   * AI Recommendation Engine: Suggests facilities based on user preferences
   */
  static async getRecommendedFacilities(
    userId: string,
    userLocation: { lat: number, lng: number }
  ): Promise<FacilityRecommendation[]> {
    // 1. Get user profile & history
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) return [];

    // 2. Get nearby facilities (this would normally come from your Places service)
    // For prototype, we assume we have a list of candidate facility IDs
    // ...

    // 3. Score each facility
    // Mock response for now to demonstrate the AI structure
    return [
      {
        facilityId: 'mock_id_1',
        score: 95,
        matchReasons: [
          'Matches your skill level (Intermediate)',
          'Usually quiet when you like to play (Evenings)',
          '3 friends have played here recently'
        ],
        bestTime: '18:00'
      },
      {
        facilityId: 'mock_id_2',
        score: 88,
        matchReasons: [
          'Highly rated for Basketball',
          'Close to your current location'
        ]
      }
    ];
  }
}


