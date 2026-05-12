# 🚀 AI Implementation Quick Start Guide
## Getting Started with AI-Powered Recommendations

This guide helps you implement the first AI feature (Facility Recommendations) to get immediate value.

---

## 🎯 Phase 1: Data Collection (Week 1)

### Step 1: Enhance Event Tracking

Add comprehensive event tracking to capture user behavior:

```typescript
// src/services/analytics.ts
export class AnalyticsService {
  static async trackEvent(event: string, properties: Record<string, any>) {
    // Store in Supabase analytics table
    await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: event,
      properties: properties,
      timestamp: new Date().toISOString()
    });
  }

  static async trackCheckIn(facilityId: string, sport: string) {
    await this.trackEvent('check_in', {
      facility_id: facilityId,
      sport: sport,
      location: await LocationService.getCurrentLocation()
    });
  }

  static async trackFacilityView(facilityId: string) {
    await this.trackEvent('facility_view', { facility_id: facilityId });
  }

  static async trackRecommendationClick(facilityId: string, source: string) {
    await this.trackEvent('recommendation_click', {
      facility_id: facilityId,
      source: source // 'ai_recommendation', 'search', 'map'
    });
  }
}
```

### Step 2: Create Analytics Table

```sql
-- Add to your database
CREATE TABLE public.user_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_events_user_id ON public.user_events(user_id);
CREATE INDEX idx_user_events_event_type ON public.user_events(event_type);
CREATE INDEX idx_user_events_timestamp ON public.user_events(timestamp);
```

### Step 3: Integrate Tracking

Update your screens to track events:

```typescript
// In MapScreen.tsx
import { AnalyticsService } from '../services/analytics';

// Track facility views
const handleMarkerPress = async (court: Court) => {
  await AnalyticsService.trackFacilityView(court.id);
  // ... existing code
};

// Track check-ins
const handleQuickCheckIn = async (sport: Sport) => {
  await AnalyticsService.trackCheckIn(selectedFacility.id, sport);
  // ... existing code
};
```

---

## 🎯 Phase 2: Basic Recommendation Engine (Week 2-3)

### Step 1: Create Recommendation Service

```typescript
// src/services/recommendationService.ts
import { supabase } from './supabase';
import { Court, Sport } from '../types';

export interface FacilityRecommendation {
  facility_id: string;
  court: Court;
  score: number; // 0-100
  reasons: string[];
  predicted_capacity?: 'low' | 'medium' | 'high';
}

export class RecommendationService {
  /**
   * Get personalized facility recommendations for user
   */
  static async getRecommendations(
    userId: string,
    userLocation: { lat: number; lng: number },
    limit: number = 10
  ): Promise<FacilityRecommendation[]> {
    
    // 1. Get user's check-in history
    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('google_place_id, sport, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 2. Get user's sport preferences
    const { data: user } = await supabase
      .from('users')
      .select('preferred_sports, sport_preference_order')
      .eq('id', userId)
      .single();

    // 3. Get nearby facilities
    const nearbyFacilities = await PlacesApiService.searchNearbySportsFacilities(
      userLocation.lat,
      userLocation.lng,
      10000 // 10km radius
    );

    // 4. Score each facility
    const recommendations = nearbyFacilities.map(facility => {
      const score = this.calculateScore(facility, checkIns || [], user);
      return {
        facility_id: facility.place_id,
        court: PlacesApiService.convertPlaceToCourtFormat(facility, []),
        score,
        reasons: this.generateReasons(facility, checkIns || [], user)
      };
    });

    // 5. Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter(r => r.score > 30); // Only show if score > 30
  }

  /**
   * Calculate recommendation score for a facility
   */
  private static calculateScore(
    facility: any,
    checkIns: any[],
    user: any
  ): number {
    let score = 0;

    // Factor 1: Historical check-ins (40 points max)
    const userCheckIns = checkIns.filter(
      ci => ci.google_place_id === facility.place_id
    );
    score += Math.min(userCheckIns.length * 10, 40);

    // Factor 2: Sport preference match (30 points max)
    const userSports = user?.preferred_sports || [];
    const facilitySports = PlacesApiService.detectSportsFromPlace(facility);
    const matchingSports = facilitySports.filter(s => 
      userSports.includes(s)
    );
    score += (matchingSports.length / facilitySports.length) * 30;

    // Factor 3: Recent activity (20 points max)
    const recentCheckIns = checkIns.filter(
      ci => ci.google_place_id === facility.place_id &&
      new Date(ci.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    score += Math.min(recentCheckIns.length * 5, 20);

    // Factor 4: Facility rating (10 points max)
    if (facility.rating) {
      score += (facility.rating / 5) * 10;
    }

    return Math.round(score);
  }

  /**
   * Generate human-readable reasons for recommendation
   */
  private static generateReasons(
    facility: any,
    checkIns: any[],
    user: any
  ): string[] {
    const reasons: string[] = [];

    const userCheckIns = checkIns.filter(
      ci => ci.google_place_id === facility.place_id
    );

    if (userCheckIns.length > 0) {
      reasons.push(`You've checked in here ${userCheckIns.length} time${userCheckIns.length > 1 ? 's' : ''}`);
    }

    const userSports = user?.preferred_sports || [];
    const facilitySports = PlacesApiService.detectSportsFromPlace(facility);
    const matchingSports = facilitySports.filter(s => userSports.includes(s));
    
    if (matchingSports.length > 0) {
      reasons.push(`Offers your preferred sports: ${matchingSports.join(', ')}`);
    }

    if (facility.rating && facility.rating >= 4.5) {
      reasons.push('Highly rated facility');
    }

    return reasons;
  }
}
```

### Step 2: Add Recommendations to Map Screen

```typescript
// In MapScreen.tsx
import { RecommendationService } from '../services/recommendationService';

const [recommendations, setRecommendations] = useState<FacilityRecommendation[]>([]);

useEffect(() => {
  if (user && userLocation) {
    loadRecommendations();
  }
}, [user, userLocation]);

const loadRecommendations = async () => {
  if (!user || !userLocation) return;
  
  const recs = await RecommendationService.getRecommendations(
    user.id,
    userLocation
  );
  setRecommendations(recs);
};

// Display recommendations in UI
{recommendations.length > 0 && (
  <View style={styles.recommendationsPanel}>
    <Text style={styles.recommendationsTitle}>Recommended for You</Text>
    {recommendations.slice(0, 3).map(rec => (
      <TouchableOpacity
        key={rec.facility_id}
        style={styles.recommendationCard}
        onPress={() => handleMarkerPress(rec.court)}
      >
        <Text style={styles.recommendationName}>{rec.court.name}</Text>
        <Text style={styles.recommendationScore}>
          {rec.score}% match
        </Text>
        {rec.reasons.map((reason, i) => (
          <Text key={i} style={styles.recommendationReason}>
            • {reason}
          </Text>
        ))}
      </TouchableOpacity>
    ))}
  </View>
)}
```

---

## 🎯 Phase 3: Capacity Predictions (Week 4-5)

### Step 1: Build Prediction Model

```typescript
// src/services/capacityPredictionService.ts
export class CapacityPredictionService {
  /**
   * Predict facility capacity for a given time
   */
  static async predictCapacity(
    facilityId: string,
    sport: string,
    targetTime: Date
  ): Promise<{
    predicted_capacity: number;
    confidence: number;
    level: 'low' | 'medium' | 'high' | 'full';
  }> {
    
    // Get historical check-ins for this facility/sport
    const { data: historicalCheckIns } = await supabase
      .from('check_ins')
      .select('created_at')
      .eq('google_place_id', facilityId)
      .eq('sport', sport)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (!historicalCheckIns || historicalCheckIns.length < 10) {
      return {
        predicted_capacity: 0,
        confidence: 0,
        level: 'low'
      };
    }

    // Simple prediction: average check-ins at similar times
    const targetHour = targetTime.getHours();
    const targetDay = targetTime.getDay(); // 0 = Sunday

    const similarTimeCheckIns = historicalCheckIns.filter(ci => {
      const ciDate = new Date(ci.created_at);
      return ciDate.getHours() === targetHour && 
             ciDate.getDay() === targetDay;
    });

    const avgCapacity = similarTimeCheckIns.length > 0
      ? similarTimeCheckIns.length
      : historicalCheckIns.length / 12; // Fallback to overall average

    // Get current capacity
    const capacity = await CapacityService.getCapacityForFacility(facilityId, sport);
    const maxCapacity = capacity?.max_capacity || 20;

    const predictedLevel = this.getCapacityLevel(avgCapacity, maxCapacity);
    const confidence = Math.min(similarTimeCheckIns.length / 10, 1) * 100;

    return {
      predicted_capacity: Math.round(avgCapacity),
      confidence: Math.round(confidence),
      level: predictedLevel
    };
  }

  private static getCapacityLevel(
    current: number,
    max: number
  ): 'low' | 'medium' | 'high' | 'full' {
    const percentage = (current / max) * 100;
    if (percentage < 25) return 'low';
    if (percentage < 50) return 'medium';
    if (percentage < 75) return 'high';
    return 'full';
  }
}
```

### Step 2: Display Predictions in UI

```typescript
// In EnhancedCourtDetailScreen.tsx
const [capacityPrediction, setCapacityPrediction] = useState(null);

useEffect(() => {
  if (court && selectedSport) {
    loadCapacityPrediction();
  }
}, [court, selectedSport]);

const loadCapacityPrediction = async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0); // 6 PM tomorrow

  const prediction = await CapacityPredictionService.predictCapacity(
    court.id,
    selectedSport,
    tomorrow
  );
  setCapacityPrediction(prediction);
};

// Display in UI
{capacityPrediction && (
  <View style={styles.predictionCard}>
    <Text style={styles.predictionTitle}>
      Best Time to Play: Tomorrow 6 PM
    </Text>
    <Text style={styles.predictionLevel}>
      Expected: {capacityPrediction.level} capacity
    </Text>
    <Text style={styles.predictionConfidence}>
      Confidence: {capacityPrediction.confidence}%
    </Text>
  </View>
)}
```

---

## 🎯 Phase 4: Advanced Features (Month 2+)

### Player Matchmaking

```typescript
// src/services/matchmakingService.ts
export class MatchmakingService {
  static async findMatches(
    userId: string,
    sport: string,
    sessionId?: string
  ): Promise<PlayerMatch[]> {
    // Get user profile
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Get potential matches (users who play same sport)
    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('user_id')
      .eq('sport', sport)
      .neq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const potentialUserIds = [...new Set(checkIns?.map(ci => ci.user_id) || [])];

    // Score each potential match
    const matches = await Promise.all(
      potentialUserIds.map(async (matchUserId) => {
        const score = await this.calculateMatchScore(userId, matchUserId, sport);
        return {
          user_id: matchUserId,
          score,
          reasons: await this.generateMatchReasons(userId, matchUserId, sport)
        };
      })
    );

    return matches
      .filter(m => m.score > 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private static async calculateMatchScore(
    userId1: string,
    userId2: string,
    sport: string
  ): Promise<number> {
    let score = 0;

    // Factor 1: Check-in frequency similarity (30 points)
    const user1CheckIns = await this.getCheckInCount(userId1, sport);
    const user2CheckIns = await this.getCheckInCount(userId2, sport);
    const frequencyDiff = Math.abs(user1CheckIns - user2CheckIns);
    score += Math.max(0, 30 - frequencyDiff);

    // Factor 2: Location proximity (30 points)
    const proximity = await this.calculateLocationProximity(userId1, userId2);
    score += proximity * 30;

    // Factor 3: Friend connection (20 points)
    const areFriends = await this.areFriends(userId1, userId2);
    if (areFriends) score += 20;

    // Factor 4: Availability overlap (20 points)
    const availabilityOverlap = await this.calculateAvailabilityOverlap(userId1, userId2);
    score += availabilityOverlap * 20;

    return Math.round(score);
  }
}
```

---

## 📊 Testing & Validation

### A/B Testing Framework

```typescript
// src/services/abTesting.ts
export class ABTestingService {
  static async shouldShowAIRecommendations(userId: string): Promise<boolean> {
    // Simple A/B test: 50% of users see AI recommendations
    const hash = this.hashUserId(userId);
    return hash % 2 === 0; // 50% chance
  }

  private static hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
```

### Metrics to Track

```typescript
// Track recommendation performance
await AnalyticsService.trackEvent('recommendation_shown', {
  facility_id: rec.facility_id,
  score: rec.score,
  user_id: user.id
});

await AnalyticsService.trackEvent('recommendation_clicked', {
  facility_id: rec.facility_id,
  score: rec.score,
  user_id: user.id
});
```

---

## 🚀 Deployment Checklist

- [ ] Analytics tracking implemented
- [ ] User events table created
- [ ] Recommendation service built
- [ ] UI components for recommendations added
- [ ] A/B testing framework set up
- [ ] Metrics dashboard created
- [ ] Performance monitoring in place
- [ ] User feedback collection ready

---

## 📈 Next Steps

1. **Week 1**: Implement data collection
2. **Week 2-3**: Build basic recommendation engine
3. **Week 4-5**: Add capacity predictions
4. **Week 6+**: Iterate based on user feedback and metrics

---

*This is a living document - update as you learn and iterate!*


