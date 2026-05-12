// ============================================================================
// SAMPLE DATA CREATOR - FOR TESTING SQUAD FEATURES
// ============================================================================

import { FeedApi } from '../services/feedApi';
import { SquadApi } from '../services/squadApi';
import { SportCode } from '../types/squad.types';

/**
 * Creates sample squad and activity data for testing
 * Run this once after setting up the database schema
 */
export async function createSampleSquadData() {
  try {
    console.log('🚀 Creating comprehensive sample squad data...');

    // Create multiple squads for different sports
    const squadsToCreate = [
      { name: 'Warriors Weekend', sport_code: 'basketball' as SportCode },
      { name: 'Tennis Pros', sport_code: 'tennis' as SportCode },
      { name: 'Pickleball Masters', sport_code: 'pickleball' as SportCode },
      { name: 'Beach Volleyball', sport_code: 'volleyball' as SportCode },
      { name: 'Badminton SF', sport_code: 'badminton' as SportCode },
    ];

    const createdSquads = [];
    
    // Note: In production, ownerId would come from the authenticated user
    const demoOwnerId = 'demo-user-id';
    
    for (const squadData of squadsToCreate) {
      const { data: squad, error } = await SquadApi.createSquad(squadData, demoOwnerId);
      if (error) {
        console.error(`Error creating ${squadData.name}:`, error);
      } else {
        console.log(`✅ Created squad: ${squad?.name}`);
        createdSquads.push(squad);
      }
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Create diverse sample activities
    const activities = [
      {
        activity_type: 'game_completed' as const,
        activity_data: {
          sport: 'basketball' as SportCode,
          location: 'Mission Bay Courts',
          facility_name: 'Mission Bay Courts',
          details: '5v5 Full Court',
          duration: 45,
          result: 'victory' as const
        },
        related_squad_id: createdSquads.find(s => s?.sport_code === 'basketball')?.id,
        is_public: true
      },
      {
        activity_type: 'squad_joined' as const,
        activity_data: {
          sport: 'tennis' as SportCode,
          squad_name: 'Tennis Pros'
        },
        related_squad_id: createdSquads.find(s => s?.sport_code === 'tennis')?.id,
        is_public: true
      },
      {
        activity_type: 'check_in' as const,
        activity_data: {
          sport: 'basketball' as SportCode,
          facility_name: 'Equinox Sports Club',
          location: 'Financial District'
        },
        is_public: true
      },
      {
        activity_type: 'game_completed' as const,
        activity_data: {
          sport: 'tennis' as SportCode,
          location: 'Dolores Park Tennis Courts',
          facility_name: 'Dolores Park Tennis Courts',
          details: 'Singles Match',
          duration: 90,
          result: 'defeat' as const
        },
        is_public: true
      },
      {
        activity_type: 'match_won' as const,
        activity_data: {
          sport: 'pickleball' as SportCode,
          location: 'Golden Gate Park',
          details: 'Tournament Semifinal',
          result: 'victory' as const
        },
        related_squad_id: createdSquads.find(s => s?.sport_code === 'pickleball')?.id,
        is_public: true
      },
      {
        activity_type: 'check_in' as const,
        activity_data: {
          sport: 'soccer' as SportCode,
          facility_name: 'Crissy Field',
          location: 'Presidio'
        },
        is_public: true
      },
      {
        activity_type: 'squad_joined' as const,
        activity_data: {
          sport: 'volleyball' as SportCode,
          squad_name: 'Beach Volleyball'
        },
        related_squad_id: createdSquads.find(s => s?.sport_code === 'volleyball')?.id,
        is_public: true
      }
    ];

    console.log(`📝 Creating ${activities.length} sample activities...`);
    let activityCount = 0;
    
    for (const activity of activities) {
      const { data, error } = await FeedApi.createActivity(activity);
      if (error) {
        console.error('❌ Error creating activity:', error);
      } else {
        activityCount++;
        console.log(`✅ Created activity: ${activity.activity_type} (${activityCount}/${activities.length})`);
      }
      // Small delay between activities
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`🎉 Sample data creation completed!`);
    console.log(`📊 Summary: ${createdSquads.length} squads, ${activityCount} activities created`);
    return { 
      success: true, 
      summary: {
        squads: createdSquads.length,
        activities: activityCount
      }
    };

  } catch (error) {
    console.error('Error creating sample data:', error);
    return { success: false, error };
  }
}

/**
 * Helper function to clear all sample data (for testing)
 */
export async function clearSampleData() {
  console.log('Clearing sample data is not implemented - use Supabase dashboard to manually delete test data');
}
