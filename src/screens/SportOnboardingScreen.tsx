import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../contexts/AuthContext';
import { Sport } from '../types';
import { SPORTS_CONFIG, SPORT_FILTERS } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingNavigationProp = StackNavigationProp<RootStackParamList>;

export default function SportOnboardingScreen() {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const { updateSportPreferences } = useAuth();
  const theme = useTheme();
  
  const [selectedSports, setSelectedSports] = useState<Set<Sport>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleSport = (sport: Sport) => {
    const newSelected = new Set(selectedSports);
    if (newSelected.has(sport)) {
      newSelected.delete(sport);
    } else {
      newSelected.add(sport);
    }
    setSelectedSports(newSelected);
  };

  const handleContinue = async () => {
    if (selectedSports.size === 0) {
      Alert.alert(
        'Select Your Sports',
        'Please select at least one sport to continue. This helps us show you the most relevant facilities.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSaving(true);
    try {
      const preferences = Array.from(selectedSports);
      // First selected sport becomes the top preference
      const preferenceOrder = preferences;
      
      await updateSportPreferences(preferences, preferenceOrder);
      
      // Navigate to main app
      navigation.replace('MainTabs');
    } catch (error) {
      console.error('Error saving sport preferences:', error);
      Alert.alert(
        'Error',
        'Failed to save your preferences. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    // Set basketball as default preference
    setSaving(true);
    try {
      await updateSportPreferences(['basketball'], ['basketball']);
      navigation.replace('MainTabs');
    } catch (error) {
      console.error('Error setting default preferences:', error);
      navigation.replace('MainTabs');
    } finally {
      setSaving(false);
    }
  };

  const renderSportCard = (sport: Sport) => {
    const config = SPORTS_CONFIG[sport];
    const isSelected = selectedSports.has(sport);
    
    return (
      <TouchableOpacity
        key={sport}
        style={[
          styles.sportCard,
          isSelected && styles.sportCardSelected,
        ]}
        onPress={() => toggleSport(sport)}
        activeOpacity={0.8}
      >
        <View style={[
          styles.sportIcon,
          { backgroundColor: isSelected ? config.color : '#f5f5f5' }
        ]}>
          <Text style={[
            styles.sportEmoji,
            { opacity: isSelected ? 1 : 0.6 }
          ]}>
            {config.icon}
          </Text>
        </View>
        
        <Text style={[
          styles.sportName,
          { color: isSelected ? '#333' : '#666' }
        ]}>
          {config.name}
        </Text>
        
        <View style={[
          styles.checkmark,
          { backgroundColor: isSelected ? config.color : 'transparent' }
        ]}>
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="white" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.welcomeIcon}>
            <Text style={styles.welcomeEmoji}>🏀</Text>
          </View>
          
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Welcome to Ralli!</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Let's personalize your experience by selecting the sports you love to play.
          </Text>
        </View>

        {/* Sports Grid */}
        <View style={styles.sportsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Choose Your Favorite Sports</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            Select all the sports you're interested in. You can change these later in your profile.
          </Text>
          
          <View style={styles.sportsGrid}>
            {SPORT_FILTERS.map(renderSportCard)}
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsSection}>
          <Text style={[styles.benefitsTitle, { color: theme.colors.textPrimary }]}>Why we ask:</Text>
          <View style={styles.benefit}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
              Map markers show your preferred sports first
            </Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="search" size={20} color={theme.colors.primary} />
            <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
              Better facility recommendations based on your interests
            </Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="people" size={20} color={theme.colors.primary} />
            <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
              Connect with players who share your favorite sports
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={handleSkip}
          disabled={saving}
        >
          <Text style={[styles.skipButtonText, { color: theme.colors.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.continueButton,
            selectedSports.size === 0 && styles.continueButtonDisabled,
            saving && styles.continueButtonSaving,
            { backgroundColor: theme.colors.primary }
          ]} 
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={[
            styles.continueButtonText,
            selectedSports.size === 0 && styles.continueButtonTextDisabled
          ]}>
            {saving ? 'Setting up...' : `Continue${selectedSports.size > 0 ? ` (${selectedSports.size})` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 32,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  welcomeEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  sportsSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  sportCard: {
    width: (SCREEN_WIDTH - 48 - 16) / 2, // Account for padding and gap
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sportCardSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#f8f9ff',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sportIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sportEmoji: {
    fontSize: 24,
  },
  sportName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  benefitsSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  continueButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  continueButtonSaving: {
    opacity: 0.8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  continueButtonTextDisabled: {
    color: '#999',
  },
});
