import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { CommunityApi, Crew, CrewMember, CrewChallenge } from '../../services/communityApi';
import { SPORTS_CONFIG } from '../../constants/sports';
import { Sport } from '../../types';
import { Gradients } from '../../design/tokens';

type CrewDetailNavProp = StackNavigationProp<RootStackParamList>;
type CrewDetailRouteProp = RouteProp<RootStackParamList, 'CrewDetail'>;

export default function CrewDetailScreen() {
  const navigation = useNavigation<CrewDetailNavProp>();
  const route = useRoute<CrewDetailRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();

  const { crewId } = route.params;

  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [challenges, setChallenges] = useState<CrewChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [rivalCrews, setRivalCrews] = useState<Crew[]>([]);
  const [challengeTime, setChallengeTime] = useState<Date>(() => getChallengePresetDate('tomorrow'));
  const [resultChallenge, setResultChallenge] = useState<CrewChallenge | null>(null);
  const [challengerScore, setChallengerScore] = useState('');
  const [challengedScore, setChallengedScore] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);

  const isCaptain = crew?.captain_id === user?.id;
  const isMember = members.some((m) => m.user_id === user?.id);
  const currentMemberRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManageCrew = currentMemberRole === 'captain' || currentMemberRole === 'co-captain';

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [crewId, user?.id])
  );

  const loadData = async () => {
    setLoading(true);
    const result = await CommunityApi.getCrewById(crewId);
    if (result) {
      setCrew(result.crew);
      setMembers(result.members);
    }
    const challengeData = await CommunityApi.getCrewChallenges(crewId);
    setChallenges(challengeData);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!user || !crew) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await CommunityApi.joinCrew(crewId, user.id);
    if (success) {
      Alert.alert('Joined!', `Welcome to ${crew.name}.`);
      loadData();
    } else {
      Alert.alert('Error', 'Could not join. Try again.');
    }
  };

  const handleLeave = () => {
    if (!user || !crew) return;
    if (isCaptain) {
      Alert.alert('Cannot Leave', 'As captain, transfer ownership before leaving.');
      return;
    }
    Alert.alert('Leave Crew?', `Are you sure you want to leave ${crew.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const success = await CommunityApi.leaveCrew(crewId, user.id);
          if (success) loadData();
        },
      },
    ]);
  };

  const handleChallengePress = async () => {
    if (!crew) return;
    if (!canManageCrew) {
      Alert.alert('Captain Only', 'Only captains and co-captains can challenge another crew.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const allCrews = await CommunityApi.getCrewsAtCourt(crew.google_place_id, user?.id);
    const rivals = allCrews.filter(
      (c) => c.id !== crewId && c.sport === crew.sport
    );
    if (rivals.length === 0) {
      Alert.alert('No Rivals', 'There are no other crews in this sport at this location yet.');
      return;
    }
    setChallengeTime(getChallengePresetDate('tomorrow'));
    setRivalCrews(rivals);
    setShowChallengeModal(true);
  };

  const handleSendChallenge = async (rivalCrewId: string) => {
    if (!crew || !user) return;
    if (!canManageCrew) {
      Alert.alert('Captain Only', 'Only captains and co-captains can send challenges.');
      return;
    }
    setShowChallengeModal(false);

    const challenge = await CommunityApi.createChallenge({
      challengerCrewId: crewId,
      challengedCrewId: rivalCrewId,
      googlePlaceId: crew.google_place_id,
      sport: crew.sport,
      proposedTime: challengeTime.toISOString(),
      message: `${crew.name} challenges you!`,
    });

    if (challenge) {
      Alert.alert('Challenge Sent!', 'The other crew will see your challenge.');
      loadData();
    } else {
      Alert.alert('Error', 'Could not send challenge. Try again.');
    }
  };

  const openResultModal = (challenge: CrewChallenge) => {
    setResultChallenge(challenge);
    setChallengerScore(challenge.challenger_score?.toString() || '');
    setChallengedScore(challenge.challenged_score?.toString() || '');
  };

  const closeResultModal = () => {
    setResultChallenge(null);
    setChallengerScore('');
    setChallengedScore('');
  };

  const handleSubmitResult = async () => {
    if (!resultChallenge) return;

    const challenger = Number.parseInt(challengerScore, 10);
    const challenged = Number.parseInt(challengedScore, 10);

    if (!Number.isFinite(challenger) || !Number.isFinite(challenged) || challenger < 0 || challenged < 0) {
      Alert.alert('Invalid Score', 'Enter non-negative scores for both crews.');
      return;
    }

    if (challenger === challenged) {
      Alert.alert('Draws Coming Soon', 'For beta, record a winner for challenge results.');
      return;
    }

    const winnerCrewId = challenger > challenged
      ? resultChallenge.challenger_crew_id
      : resultChallenge.challenged_crew_id;

    try {
      setSubmittingResult(true);
      const success = await CommunityApi.recordChallengeResult(
        resultChallenge.id,
        winnerCrewId,
        challenger,
        challenged
      );

      if (!success) {
        Alert.alert('Error', 'Could not record result. Make sure you are a captain or co-captain.');
        return;
      }

      closeResultModal();
      await loadData();
      Alert.alert('Result Recorded', 'Challenge result has been saved.');
    } finally {
      setSubmittingResult(false);
    }
  };

  const handleRespondToChallenge = (challenge: CrewChallenge, accept: boolean) => {
    if (!canManageCrew || challenge.challenged_crew_id !== crewId) {
      Alert.alert('Captain Only', 'Only the challenged crew captain or co-captain can respond.');
      return;
    }

    Alert.alert(
      accept ? 'Accept Challenge?' : 'Decline Challenge?',
      accept
        ? `Accept the challenge from ${challenge.challenger_crew?.name || 'opponent'}?`
        : `Decline the challenge from ${challenge.challenger_crew?.name || 'opponent'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: accept ? 'Accept' : 'Decline',
          style: accept ? 'default' : 'destructive',
          onPress: async () => {
            await CommunityApi.respondToChallenge(
              challenge.id,
              accept ? 'accepted' : 'declined'
            );
            loadData();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!crew) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.danger} />
          <Text style={[styles.errorText, { color: theme.colors.textPrimary }]}>Crew not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.primary, marginTop: 12 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sportConfig = SPORTS_CONFIG[crew.sport as Sport];
  const totalGames = crew.wins + crew.losses + crew.draws;
  const winRate = totalGames > 0 ? Math.round((crew.wins / totalGames) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {crew.name}
        </Text>
        {isCaptain && (
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Crew Banner */}
        <LinearGradient
          colors={[sportConfig?.color || '#3B57FF', (sportConfig?.color || '#3B57FF') + 'AA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <Text style={styles.bannerEmoji}>{sportConfig?.icon || '🏀'}</Text>
          <Text style={styles.bannerName}>{crew.name}</Text>
          <Text style={styles.bannerSport}>{sportConfig?.name || crew.sport}</Text>
        </LinearGradient>

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{crew.member_count || members.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Members</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#22C55E' }]}>{crew.wins}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Wins</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{crew.losses}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Losses</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>{winRate}%</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Win Rate</Text>
          </View>
        </View>

        {crew.description && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.descriptionText, { color: theme.colors.textSecondary }]}>
              {crew.description}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {isMember ? (
            <>
              {canManageCrew && (
                <TouchableOpacity
                  style={styles.actionButtonWrapper}
                  onPress={handleChallengePress}
                >
                  <LinearGradient
                    colors={[...Gradients.ralliPrimary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="flash" size={18} color="white" />
                    <Text style={styles.actionButtonText}>Challenge</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.leaveButton, { borderColor: theme.colors.danger }]}
                onPress={handleLeave}
              >
                <Text style={[styles.leaveButtonText, { color: theme.colors.danger }]}>Leave Crew</Text>
              </TouchableOpacity>
            </>
          ) : crew.is_open ? (
            <TouchableOpacity style={styles.actionButtonWrapper} onPress={handleJoin}>
              <LinearGradient
                colors={[...Gradients.ralliPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButton}
              >
                <Ionicons name="person-add" size={18} color="white" />
                <Text style={styles.actionButtonText}>Join Crew</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={[styles.closedBanner, { backgroundColor: theme.colors.border }]}>
              <Ionicons name="lock-closed" size={16} color={theme.colors.textMuted} />
              <Text style={[styles.closedText, { color: theme.colors.textMuted }]}>This crew is invite-only</Text>
            </View>
          )}
        </View>

        {/* Members */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Members</Text>
          {members.map((member) => (
            <View key={member.user_id} style={styles.memberItem}>
              <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary + '15' }]}>
                <Text style={[styles.memberAvatarText, { color: theme.colors.primary }]}>
                  {(member.full_name || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: theme.colors.textPrimary }]}>
                  {member.full_name || 'Unknown'}
                </Text>
                {member.role !== 'member' && (
                  <Text style={[styles.memberRole, { color: sportConfig?.color || theme.colors.primary }]}>
                    {member.role === 'captain' ? 'Captain' : 'Co-Captain'}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Challenges */}
        {challenges.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Challenges</Text>
            {challenges.map((challenge) => {
              const isChallenger = challenge.challenger_crew_id === crewId;
              const opponentName = isChallenger
                ? challenge.challenged_crew?.name || 'Unknown'
                : challenge.challenger_crew?.name || 'Unknown';
              const canRespond = !isChallenger && challenge.status === 'pending' && canManageCrew;
              const canRecordResult = challenge.status === 'accepted' && canManageCrew;

              return (
                <View
                  key={challenge.id}
                  style={[styles.challengeCard, { borderColor: theme.colors.border }]}
                >
                  <View style={styles.challengeHeader}>
                    <Ionicons
                      name={
                        challenge.status === 'completed'
                          ? 'trophy'
                          : challenge.status === 'accepted'
                          ? 'checkmark-circle'
                          : challenge.status === 'pending'
                          ? 'time'
                          : 'close-circle'
                      }
                      size={18}
                      color={
                        challenge.status === 'completed'
                          ? '#F59E0B'
                          : challenge.status === 'accepted'
                          ? '#22C55E'
                          : challenge.status === 'pending'
                          ? theme.colors.primary
                          : '#EF4444'
                      }
                    />
                    <Text style={[styles.challengeOpponent, { color: theme.colors.textPrimary }]}>
                      {isChallenger ? 'vs ' : 'from '}{opponentName}
                    </Text>
                    <Text style={[styles.challengeStatus, { color: theme.colors.textMuted }]}>
                      {challenge.status}
                    </Text>
                  </View>
                  <Text style={[styles.challengeTime, { color: theme.colors.textSecondary }]}>
                    {new Date(challenge.proposed_time).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>

                  {challenge.status === 'completed' && (
                    <Text style={[styles.challengeScore, { color: theme.colors.textPrimary }]}>
                      {challenge.challenger_score} - {challenge.challenged_score}
                    </Text>
                  )}

                  {canRespond && (
                    <View style={styles.challengeActions}>
                      <TouchableOpacity
                        style={[styles.acceptBtn, { backgroundColor: '#22C55E' }]}
                        onPress={() => handleRespondToChallenge(challenge, true)}
                      >
                        <Text style={styles.challengeBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.declineBtn, { borderColor: '#EF4444' }]}
                        onPress={() => handleRespondToChallenge(challenge, false)}
                      >
                        <Text style={[styles.challengeBtnText, { color: '#EF4444' }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {canRecordResult && (
                    <TouchableOpacity
                      style={[styles.recordResultButton, { borderColor: theme.colors.primary }]}
                      onPress={() => openResultModal(challenge)}
                    >
                      <Text style={[styles.recordResultText, { color: theme.colors.primary }]}>
                        Record Result
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Challenge Picker Modal */}
      <Modal visible={showChallengeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              Pick a Rival
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Proposed time
            </Text>
            <View style={styles.challengeTimeOptions}>
              {[
                { id: 'tomorrow', label: 'Tomorrow 6 PM' },
                { id: 'weekend', label: 'Saturday 10 AM' },
                { id: 'nextWeek', label: 'Next Week 6 PM' },
              ].map((preset) => {
                const presetDate = getChallengePresetDate(preset.id as ChallengePreset);
                const selected = Math.abs(presetDate.getTime() - challengeTime.getTime()) < 1000;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.challengeTimeChip,
                      { borderColor: selected ? theme.colors.primary : theme.colors.border },
                      selected && { backgroundColor: theme.colors.primary + '15' },
                    ]}
                    onPress={() => setChallengeTime(presetDate)}
                  >
                    <Text style={{ color: selected ? theme.colors.primary : theme.colors.textSecondary }}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <FlatList
              data={rivalCrews}
              keyExtractor={(item) => item.id}
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={5}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.rivalItem, { borderColor: theme.colors.border }]}
                  onPress={() => handleSendChallenge(item.id)}
                >
                  <Text style={[styles.rivalName, { color: theme.colors.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rivalMeta, { color: theme.colors.textMuted }]}>
                    {item.member_count} members · {item.wins}W-{item.losses}L
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={[styles.modalCancel, { borderColor: theme.colors.border }]}
              onPress={() => setShowChallengeModal(false)}
            >
              <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!resultChallenge} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              Record Result
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              {resultChallenge?.challenger_crew?.name || 'Challenger'} vs {resultChallenge?.challenged_crew?.name || 'Opponent'}
            </Text>

            <View style={styles.scoreInputRow}>
              <View style={styles.scoreInputGroup}>
                <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>
                  {resultChallenge?.challenger_crew?.name || 'Challenger'}
                </Text>
                <TextInput
                  style={[styles.scoreInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  keyboardType="number-pad"
                  value={challengerScore}
                  onChangeText={setChallengerScore}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
              <View style={styles.scoreInputGroup}>
                <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>
                  {resultChallenge?.challenged_crew?.name || 'Opponent'}
                </Text>
                <TextInput
                  style={[styles.scoreInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  keyboardType="number-pad"
                  value={challengedScore}
                  onChangeText={setChallengedScore}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitResultButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSubmitResult}
              disabled={submittingResult}
            >
              {submittingResult ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitResultText}>Save Result</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancel, { borderColor: theme.colors.border }]}
              onPress={closeResultModal}
            >
              <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type ChallengePreset = 'tomorrow' | 'weekend' | 'nextWeek';

function getChallengePresetDate(preset: ChallengePreset): Date {
  const date = new Date();

  if (preset === 'weekend') {
    const day = date.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntilSaturday);
    date.setHours(10, 0, 0, 0);
    return date;
  }

  if (preset === 'nextWeek') {
    date.setDate(date.getDate() + 7);
    date.setHours(18, 0, 0, 0);
    return date;
  }

  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return date;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  settingsButton: {
    padding: 4,
  },
  content: {
    paddingBottom: 40,
  },
  banner: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  bannerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  bannerName: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
  },
  bannerSport: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  section: {
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  actionButtonWrapper: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  leaveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  closedBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  closedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  challengeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeOpponent: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  challengeStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  challengeTime: {
    fontSize: 13,
    marginTop: 6,
  },
  challengeScore: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  acceptBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  challengeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  recordResultButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 10,
  },
  recordResultText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
  },
  challengeTimeOptions: {
    gap: 8,
    marginBottom: 14,
  },
  challengeTimeChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  rivalItem: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  rivalName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rivalMeta: {
    fontSize: 13,
    marginTop: 3,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scoreInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  scoreInputGroup: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  scoreInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  submitResultButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 12,
  },
  submitResultText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
});
