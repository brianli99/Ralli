import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { CommunityApi, Crew } from '../../services/communityApi';
import { SPORTS_CONFIG } from '../../constants/sports';
import { Sport } from '../../types';
import { Gradients } from '../../design/tokens';

type CourtCrewsNavProp = StackNavigationProp<RootStackParamList>;
type CourtCrewsRouteProp = RouteProp<RootStackParamList, 'CourtCrews'>;

export default function CourtCrewsScreen() {
  const navigation = useNavigation<CourtCrewsNavProp>();
  const route = useRoute<CourtCrewsRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();

  const { googlePlaceId, facilityName } = route.params;

  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadCrews();
    }, [googlePlaceId, user?.id])
  );

  const loadCrews = async () => {
    setLoading(true);
    const data = await CommunityApi.getCrewsAtCourt(googlePlaceId, user?.id);
    setCrews(data);
    setLoading(false);
  };

  const handleJoinCrew = async (crew: Crew) => {
    if (!user) return;

    if (!crew.is_open) {
      Alert.alert('Closed Crew', 'This crew is not accepting new members.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await CommunityApi.joinCrew(crew.id, user.id);
    if (success) {
      Alert.alert('Joined!', `You're now a member of ${crew.name}.`);
      loadCrews();
    } else {
      Alert.alert('Error', 'Could not join crew. Try again.');
    }
  };

  const renderCrewCard = ({ item }: { item: Crew }) => {
    const sportConfig = SPORTS_CONFIG[item.sport as Sport];
    const winRate =
      item.wins + item.losses + item.draws > 0
        ? Math.round((item.wins / (item.wins + item.losses + item.draws)) * 100)
        : null;

    return (
      <TouchableOpacity
        style={[styles.crewCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => navigation.navigate('CrewDetail', { crewId: item.id })}
        activeOpacity={0.7}
      >
        {/* Crew icon */}
        <View style={[styles.crewIcon, { backgroundColor: (sportConfig?.color || '#3B57FF') + '15' }]}>
          <Text style={styles.crewEmoji}>{sportConfig?.icon || '🏀'}</Text>
        </View>

        <View style={styles.crewInfo}>
          <Text style={[styles.crewName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.crewMeta}>
            <Ionicons name="people-outline" size={13} color={theme.colors.textMuted} />
            <Text style={[styles.crewMetaText, { color: theme.colors.textMuted }]}>
              {item.member_count || 0}/{item.max_members}
            </Text>
            {winRate !== null && (
              <>
                <Text style={[styles.crewMetaDot, { color: theme.colors.textMuted }]}>·</Text>
                <Ionicons name="trophy-outline" size={13} color={theme.colors.textMuted} />
                <Text style={[styles.crewMetaText, { color: theme.colors.textMuted }]}>
                  {item.wins}W - {item.losses}L
                </Text>
              </>
            )}
          </View>
          {item.description && (
            <Text style={[styles.crewDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>

        {item.is_member ? (
          <View style={[styles.memberBadge, { backgroundColor: theme.colors.primary + '15' }]}>
            <Text style={[styles.memberBadgeText, { color: theme.colors.primary }]}>Member</Text>
          </View>
        ) : item.is_open ? (
          <TouchableOpacity
            style={[styles.joinButton, { borderColor: theme.colors.primary }]}
            onPress={() => handleJoinCrew(item)}
          >
            <Text style={[styles.joinButtonText, { color: theme.colors.primary }]}>Join</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.memberBadge, { backgroundColor: theme.colors.border }]}>
            <Ionicons name="lock-closed" size={12} color={theme.colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="shield-outline" size={56} color={theme.colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No crews here yet</Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
          Start a crew at {facilityName} and rally your regulars.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            Crews
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {facilityName}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('CreateCrew', { googlePlaceId, facilityName })
          }
        >
          <LinearGradient
            colors={[...Gradients.ralliPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButton}
          >
            <Ionicons name="add" size={22} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={crews}
          keyExtractor={(item) => item.id}
          renderItem={renderCrewCard}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={crews.length === 0 ? styles.emptyList : styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  crewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  crewEmoji: {
    fontSize: 22,
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    fontSize: 16,
    fontWeight: '700',
  },
  crewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  crewMetaText: {
    fontSize: 12,
  },
  crewMetaDot: {
    fontSize: 12,
  },
  crewDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  memberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  memberBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  joinButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    marginLeft: 8,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
